# Third-party notices

Camera screening uses NudeNet 3.4.2 as a separate Python process. Upstream: https://github.com/notAI-tech/NudeNet . The installed distribution includes GNU Affero General Public License v3 text in both its LICENSE and LICENSE.md files; an unchanged copy is in `licenses/NudeNet-LICENSE.txt`. Its package metadata separately labels MIT; do not rely on that metadata as a substitute for reviewing upstream licensing and applicable obligations before redistribution or hosted use. No general proprietary license is granted for third-party code or models by this project.

The clothed camera-test fixture derives from the scikit-image astronaut example, a NASA photograph of Eileen Collins. See `tests/fixtures/README.md` for source and attribution. It is used only as an explicitly synthetic camera source in automated tests.

Other dependencies keep their upstream licenses in their distributions. Node dependencies are pinned in package-lock.json and Python screening dependencies in requirements-video.txt. No third-party SDK for advertising, analytics or payments is included.
