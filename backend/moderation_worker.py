"""Memory-only camera screening. Each displayed remote frame passes this worker.

Uses the unmodified NudeNet 3.4.2 (AGPL-3.0) model and detection code.
The small adapter below bounds ONNX/OpenCV threads for shared CPU hosts.
No media is saved, logged, or sent to an external moderation service.
"""
import base64
import io
import json
import sys
from importlib.resources import files

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image
from nudenet import NudeDetector

Image.MAX_IMAGE_PIXELS = 640 * 480
cv2.setNumThreads(1)


class SharedCpuDetector(NudeDetector):
    """Keep upstream detect/preprocessing, with one inference worker thread.

    NudeNet 3.4.2's constructor does not accept SessionOptions. Its default
    ONNX thread pool uses the host's visible cores, exceeding a small shared
    CPU quota and spending that quota spinning between frames.
    """
    def __init__(self):
        options = ort.SessionOptions()
        options.intra_op_num_threads = 1
        options.inter_op_num_threads = 1
        options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
        options.add_session_config_entry('session.intra_op.allow_spinning', '0')
        options.add_session_config_entry('session.inter_op.allow_spinning', '0')
        self.onnx_session = ort.InferenceSession(
            str(files('nudenet').joinpath('320n.onnx')),
            sess_options=options, providers=['CPUExecutionProvider'],
        )
        self.input_width = 320
        self.input_height = 320
        self.input_name = self.onnx_session.get_inputs()[0].name


detector = SharedCpuDetector()
EXPOSED = {
    'FEMALE_GENITALIA_EXPOSED', 'MALE_GENITALIA_EXPOSED',
    'BUTTOCKS_EXPOSED', 'FEMALE_BREAST_EXPOSED',
    'MALE_BREAST_EXPOSED', 'ANUS_EXPOSED',
}


def inspect_frame(raw):
    if len(raw) > 120_000 or len(raw) < 50:
        return {'allowed': False, 'reason': 'invalid_frame'}
    image = Image.open(io.BytesIO(raw))
    if image.format != 'JPEG' or not (96 <= image.width <= 640 and 96 <= image.height <= 480):
        return {'allowed': False, 'reason': 'invalid_frame'}
    pixels = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
    if pixels is None:
        return {'allowed': False, 'reason': 'invalid_frame'}
    gray = cv2.cvtColor(pixels, cv2.COLOR_BGR2GRAY)
    if float(gray.mean()) < 12 and float(np.mean(gray > 30)) < .005:
        return {'allowed': False, 'reason': 'black_screen'}
    detections = detector.detect(pixels)
    for item in sorted(detections, key=lambda item: item['score'], reverse=True):
        if item['class'] in EXPOSED and item['score'] >= .50:
            return {'allowed': False, 'reason': 'exposure', 'label': item['class'], 'score': round(item['score'], 3)}
    # Do not infer gender from the face labels. Only check whether a face is visible.
    if not any(item['class'] in ('FACE_FEMALE', 'FACE_MALE') and item['score'] >= .30 for item in detections):
        return {'allowed': False, 'reason': 'not_visible'}
    return {'allowed': True, 'reason': 'clear'}


print(json.dumps({'ready': True, 'model': 'NudeNet 3.4.2 / 320n'}), flush=True)
for line in sys.stdin:
    request_id = None
    try:
        request = json.loads(line)
        request_id = request.get('id')
        raw = base64.b64decode(request['image'], validate=True)
        verdict = inspect_frame(raw)
        print(json.dumps({'id': request_id, **verdict}), flush=True)
    except Exception:
        print(json.dumps({'id': request_id, 'allowed': False, 'reason': 'screening_error'}), flush=True)
