import React, { useRef, useState, useCallback, useEffect } from 'react';
import { CameraIcon, SwitchCameraIcon } from './Icons';

interface CameraCaptureProps {
  onCapture: (photoB64: string) => void;
  maxCaptures: number;
  captures: string[];
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, maxCaptures, captures }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);


  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);

        const constraints = {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: facingMode
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setIsCameraOn(true);
          setError(null);
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("No se pudo acceder a la cámara. Por favor, revisa los permisos.");
        setIsCameraOn(false);
      }
    } else {
      setError("La cámara no es compatible con este navegador.");
    }
  }, [stopCamera, facingMode]);

  useEffect(() => {
    if (isCameraOn) {
      startCamera();
    }
  }, [facingMode]);

  const handleSwitchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current && captures.length < maxCaptures) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
        onCapture(dataUrl);
      }
    }
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden h-64 flex items-center justify-center">
        <video ref={videoRef} className={`w-full h-full object-cover ${!isCameraOn && 'hidden'}`} playsInline />
        {!isCameraOn && <div className="text-white text-center p-4">La cámara está apagada.</div>}
        <canvas ref={canvasRef} className="hidden" />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div className="flex justify-center items-center flex-wrap gap-4">
        {!isCameraOn ? (
          <button type="button" onClick={startCamera} className="bg-sena-green text-white px-4 py-2 rounded-lg hover:bg-opacity-80 transition-colors">
            Iniciar Cámara
          </button>
        ) : (
          <button type="button" onClick={stopCamera} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-opacity-80 transition-colors">
            Detener Cámara
          </button>
        )}
        <button
          type="button"
          onClick={handleCapture}
          disabled={!isCameraOn || captures.length >= maxCaptures}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
        >
          <CameraIcon className="w-5 h-5" />
          Capturar ({captures.length}/{maxCaptures})
        </button>
        {isCameraOn && hasMultipleCameras && (
            <button
              type="button"
              onClick={handleSwitchCamera}
              className="p-2 bg-gray-600 text-white rounded-full hover:bg-gray-700 transition-colors"
              aria-label="Cambiar cámara"
            >
              <SwitchCameraIcon className="w-5 h-5" />
            </button>
        )}
      </div>
    </div>
  );
};
