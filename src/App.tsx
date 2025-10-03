import { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Users, CheckCircle2, Loader2, AlertCircle, VideoOff } from 'lucide-react';
import { generateClothingDescription } from './lib/gemini';

// Type definitions for object detection
interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

interface ObjectDetectionModel {
  detect: (source: HTMLVideoElement) => Promise<DetectedObject[]>;
}

declare global {
  interface Window {
    cocoSsd: {
      load: () => Promise<ObjectDetectionModel>;
    };
    tf: any;
  }
}

// Type for a detected human event
interface DetectedHuman {
  id: string;
  timestamp: string;
  imageData: string; // Base64 encoded image
  description: string;
  isProcessing: boolean;
}

function App() {
  const [isLiveFeedVisible, setIsLiveFeedVisible] = useState(false);
  const [detectedHumans, setDetectedHumans] = useState<DetectedHuman[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing Recognito...');
  const [error, setError] = useState<string>('');
  const [model, setModel] = useState<ObjectDetectionModel | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastDetectionTime = useRef<number>(0);
  const animationFrameId = useRef<number>();

  const initCamera = useCallback(async () => {
    try {
      setLoadingMessage('Accessing camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(err => {
                console.error("Video play error:", err);
                setError("Failed to play video stream.");
              });
              resolve(null);
            };
          }
        });
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Camera access denied. Please grant camera permissions to use this app.');
    }
  }, []);

  useEffect(() => {
    const checkForLibs = () => {
      if (window.tf && window.cocoSsd) {
        loadAndInit();
      } else {
        setLoadingMessage('Loading AI libraries...');
        setTimeout(checkForLibs, 100); // Poll every 100ms
      }
    };

    async function loadAndInit() {
      try {
        setLoadingMessage('Configuring AI backend...');
        await window.tf.setBackend('cpu');

        setLoadingMessage('Loading detection model...');
        const loadedModel = await window.cocoSsd.load();
        setModel(loadedModel);

        await initCamera();

      } catch (err) {
        console.error("Initialization failed:", err);
        setError("Failed to initialize AI model. Please refresh.");
      } finally {
        setIsLoading(false);
      }
    }

    checkForLibs();

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera]);

  const captureSnapshot = useCallback((): string => {
    if (!videoRef.current) return '';
    const canvas = document.createElement('canvas');
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    return '';
  }, []);

  const processNewDetection = useCallback(async (snapshot: string) => {
    const newDetectionId = `${Date.now()}`;
    const newHuman: DetectedHuman = {
      id: newDetectionId,
      timestamp: new Date().toLocaleTimeString(),
      imageData: snapshot,
      description: 'Processing...',
      isProcessing: true,
    };

    setDetectedHumans(prev => [newHuman, ...prev].slice(0, 50)); // Keep the list from growing indefinitely

    const description = await generateClothingDescription(snapshot);

    setDetectedHumans(prev =>
      prev.map(h =>
        h.id === newDetectionId ? { ...h, description, isProcessing: false } : h
      )
    );
  }, []);

  const detect = useCallback(async () => {
    if (model && videoRef.current && videoRef.current.readyState >= 3) {
      const predictions: DetectedObject[] = await model.detect(videoRef.current);
      const humanPrediction = predictions.find(p => p.class === 'person' && p.score > 0.65);

      const now = Date.now();
      if (humanPrediction && (now - lastDetectionTime.current > 10000)) { // 10-second cooldown
        lastDetectionTime.current = now;
        const snapshot = captureSnapshot();
        if (snapshot) processNewDetection(snapshot);
      }

      if (isLiveFeedVisible && canvasRef.current && videoRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
              canvasRef.current.width = videoRef.current.videoWidth;
              canvasRef.current.height = videoRef.current.videoHeight;
              ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
              predictions.forEach(p => {
                  ctx.strokeStyle = '#8A63D2';
                  ctx.lineWidth = 2;
                  ctx.strokeRect(...p.bbox);
                  ctx.fillStyle = '#8A63D2';
                  ctx.font = '16px Inter, sans-serif';
                  ctx.fillText(`${p.class} (${(p.score * 100).toFixed(0)}%)`, p.bbox[0], p.bbox[1] > 10 ? p.bbox[1] - 5 : 10);
              });
          }
      }
    }
    animationFrameId.current = requestAnimationFrame(detect);
  }, [model, captureSnapshot, processNewDetection, isLiveFeedVisible]);

  useEffect(() => {
    if (model && !error) {
      detect();
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [model, error, detect]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface">
        <Loader2 size={48} className="animate-spin text-primary mb-4" />
        <h2 className="text-2xl font-semibold">Recognito</h2>
        <p className="text-on-surface-variant">{loadingMessage}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center text-on-surface p-6">
        <AlertCircle size={48} className="text-red-500 mb-4" />
        <h2 className="text-2xl font-semibold text-red-400">An Error Occurred</h2>
        <p className="text-on-surface-variant text-center max-w-md">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-outline">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-on-surface">Recognito</h1>
          <div className="flex items-center gap-2 text-primary">
            <CheckCircle2 size={18} />
            <span className="text-sm font-medium">System Active</span>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface rounded-lg border border-outline p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2">
                <Eye size={20} />
                Live Feed
              </h2>
              <button
                onClick={() => setIsLiveFeedVisible(!isLiveFeedVisible)}
                className="px-4 py-2 bg-primary text-white rounded-md font-medium hover:bg-opacity-90 transition-colors"
              >
                {isLiveFeedVisible ? 'Hide Feed' : 'Show Feed'}
              </button>
            </div>
            <div className="aspect-video bg-black rounded border border-outline flex items-center justify-center relative">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${!isLiveFeedVisible && 'hidden'}`}
                playsInline
                muted
              />
              <canvas
                  ref={canvasRef}
                  className={`absolute top-0 left-0 w-full h-full ${!isLiveFeedVisible && 'hidden'}`}
              />
              {!isLiveFeedVisible && (
                <div className="flex flex-col items-center justify-center text-on-surface-variant">
                  <VideoOff size={48} className="mb-4" />
                  <p>Live feed is hidden</p>
                  <p className="text-sm">Detection is active in the background</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-surface rounded-lg border border-outline p-6">
            <h2 className="text-xl font-semibold text-on-surface flex items-center gap-2 mb-4">
              <Users size={20} />
              Detected Humans
            </h2>
            <div className="space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar pr-2">
              {detectedHumans.length === 0 ? (
                <div className="text-center py-12 text-on-surface-variant">
                  <Users size={32} className="mx-auto mb-2" />
                  <p>No humans detected yet.</p>
                  <p className="text-sm">System is actively scanning...</p>
                </div>
              ) : (
                detectedHumans.map((human) => (
                  <div key={human.id} className="bg-background rounded-lg border border-outline p-4 animate-fade-in">
                    <img
                      src={human.imageData}
                      alt={`Detection at ${human.timestamp}`}
                      className="w-full rounded-md mb-3 border border-outline"
                    />
                    <div className="flex justify-between items-center text-xs text-on-surface-variant mb-2">
                      <span>ID: {human.id}</span>
                      <span>{human.timestamp}</span>
                    </div>
                    <div className="text-sm text-on-surface leading-relaxed">
                      {human.isProcessing ? (
                        <div className="flex items-center gap-2 text-on-surface-variant">
                          <Loader2 size={16} className="animate-spin" />
                          <span>Generating description...</span>
                        </div>
                      ) : (
                        <p>{human.description}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
        }
      `}</style>
    </div>
  );
}

export default App;