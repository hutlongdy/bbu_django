(() => {
    const scanner = document.querySelector("[data-attendance-scanner]");
    if (!scanner) return;

    const video = scanner.querySelector("[data-camera-preview]");
    const status = scanner.querySelector("[data-scan-status]");
    const startButton = scanner.querySelector("[data-camera-start]");
    const stopButton = scanner.querySelector("[data-camera-stop]");
    const csrfToken = scanner.querySelector("[name=csrfmiddlewaretoken]").value;
    const canvas = document.createElement("canvas");
    const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
    let activeAction = "check_in";
    let cameraStream = null;
    let requestPending = false;
    let detector = null;
    let lastDecodeAt = 0;

    function setStatus(message, isError = false) {
        status.textContent = message;
        status.classList.toggle("scan-status-error", isError);
    }

    function stopCamera() {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
            cameraStream = null;
        }
        video.srcObject = null;
        video.hidden = true;
        startButton.hidden = false;
        stopButton.hidden = true;
    }

    async function submitScan(studentNumber) {
        requestPending = true;
        try {
            const response = await fetch(scanner.dataset.endpoint, {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "X-CSRFToken": csrfToken,
                },
                body: new URLSearchParams({
                    action: activeAction,
                    student_number: studentNumber,
                }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || "Attendance scan failed.");

            setStatus(
                `${result.message}: ${result.student} (${result.student_number}), ` +
                `${result.class_name} at ${result.time}.`
            );
        } catch (error) {
            setStatus(error.message || "Could not save this attendance scan.", true);
        } finally {
            window.setTimeout(() => {
                requestPending = false;
            }, 1200);
        }
    }

    async function scanFrame() {
        if (!cameraStream) return;
        try {
            if (
                !requestPending &&
                video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA &&
                performance.now() - lastDecodeAt >= 180
            ) {
                lastDecodeAt = performance.now();
                let studentNumber;
                if (detector) {
                    try {
                        const codes = await detector.detect(video);
                        studentNumber = codes.find((code) => code.rawValue)?.rawValue;
                    } catch (_error) {
                        detector = null;
                    }
                }
                if (!studentNumber && window.jsQR && canvasContext) {
                    const scale = Math.min(1, 640 / video.videoWidth);
                    canvas.width = Math.round(video.videoWidth * scale);
                    canvas.height = Math.round(video.videoHeight * scale);
                    canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const frame = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
                    studentNumber = window.jsQR(
                        frame.data,
                        frame.width,
                        frame.height,
                        { inversionAttempts: "dontInvert" }
                    )?.data;
                }
                if (studentNumber) await submitScan(studentNumber);
            }
        } catch (error) {
            setStatus(error.message || "The camera could not read a QR code.", true);
            stopCamera();
            return;
        }
        if (cameraStream) window.requestAnimationFrame(scanFrame);
    }

    scanner.querySelectorAll("[data-scan-action]").forEach((button) => {
        button.addEventListener("click", () => {
            activeAction = button.dataset.scanAction;
            scanner.querySelectorAll("[data-scan-action]").forEach((actionButton) => {
                const selected = actionButton === button;
                actionButton.setAttribute("aria-pressed", String(selected));
                actionButton.classList.toggle("button-primary", selected);
                actionButton.classList.toggle("button-secondary", !selected);
            });
            setStatus(`Ready to scan a student QR code for ${button.textContent.toLowerCase()}.`);
        });
    });

    startButton.addEventListener("click", async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus("Camera access requires HTTPS and a supported browser.", true);
            return;
        }

        try {
            if ("BarcodeDetector" in window) {
                try {
                    detector = new BarcodeDetector({ formats: ["qr_code"] });
                } catch (_error) {
                    detector = null;
                }
            }
            if (!detector && !window.jsQR) {
                throw new Error("The QR decoder did not load. Refresh the page and try again.");
            }
            if (!canvasContext) {
                throw new Error("This browser cannot prepare camera frames for QR scanning.");
            }
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "environment" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
            });
            video.srcObject = cameraStream;
            video.hidden = false;
            await video.play();
            startButton.hidden = true;
            stopButton.hidden = false;
            setStatus("Camera is on. Hold a student QR code in view.");
            window.requestAnimationFrame(scanFrame);
        } catch (error) {
            stopCamera();
            setStatus(error.message || "Could not start the camera.", true);
        }
    });

    stopButton.addEventListener("click", () => {
        stopCamera();
        setStatus("Camera stopped.");
    });
})();
