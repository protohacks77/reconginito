import { useEffect, useRef, useState, useCallback } from 'react';
import { Camera, AlertCircle, Zap, Loader2 } from 'lucide-react';

interface Detection {
  id: string;
  timestamp: number;
  objects: Array<{
    label: string;
    confidence: number;
    bbox: number[];
  }>;
  imageData: string;
  explanation: string;
}

interface DetectedObject {
  class: string;
  score: number;
  bbox: [number, number, number, number];
}

declare global {
  interface Window {
    cocoSsd: any;
  }
}

function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [model, setModel] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [detections, setDetections] = useState<Detection[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);
  const [currentObjects, setCurrentObjects] = useState<string[]>([]);
  const lastDetectionTime = useRef<Map<string, number>>(new Map());
  const animationFrameId = useRef<number>();
  const detectionIntervalRef = useRef<NodeJS.Timeout>();

  // Generate AI explanation for detected objects
  const generateExplanation = useCallback((objects: Array<{ label: string; confidence: number }>) => {
    const objectDescriptions: Record<string, string> = {
      person: 'A human being detected in the frame. Humans are bipedal primates known for their advanced cognitive abilities.',
      laptop: 'A portable computer designed for mobile use, featuring an integrated display and keyboard.',
      'cell phone': 'A mobile communication device with computing capabilities, essential for modern connectivity.',
      book: 'A written or printed work consisting of pages, used for recording information or stories.',
      chair: 'A piece of furniture designed for sitting, typically featuring a backrest and four legs.',
      cup: 'A container used for holding beverages, essential for daily hydration and refreshment.',
      bottle: 'A rigid container typically used for storing liquids, designed with a narrow neck.',
      keyboard: 'An input device featuring keys for typing, essential for computer interaction.',
      mouse: 'A pointing device used to interact with computer interfaces through cursor control.',
      monitor: 'A display screen for computers, showing visual output from the system.',
      backpack: 'A bag carried on the back with straps, used for transporting personal items.',
      car: 'A wheeled motor vehicle designed for transportation on roads.',
      dog: 'A domesticated carnivorous mammal, known as humans best companion animal.',
      cat: 'A small domesticated feline, popular as a pet for its independence and affection.',
      clock: 'A device for measuring and displaying time, essential for scheduling and time management.',
      vase: 'A decorative container typically used for displaying flowers.',
      scissors: 'A cutting instrument with two blades, used for various cutting tasks.',
      teddy_bear: 'A stuffed toy bear, often given as a gift or comfort item.',
      plant: 'A living organism that typically produces oxygen through photosynthesis.',
      tv: 'A television set for displaying broadcast content and entertainment media.'
    };

    if (objects.length === 1) {
      const obj = objects[0];
      const desc = objectDescriptions[obj.label.toLowerCase()] ||
        `A ${obj.label} has been detected in the scene.`;
      return `${desc} (Confidence: ${(obj.confidence * 100).toFixed(1)}%)`;
    } else {
      const labels = objects.map(o => o.label).join(', ');
      return `Multiple objects detected: ${labels}. The AI vision system has identified ${objects.length} distinct objects in this frame.`;
    }
  }, []);

  // Initialize camera
  const initCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error('Video play error:', err);
          });
        };
      }
    } catch (err) {
      setError('Camera access denied. Please grant camera permissions to use this app.');
      console.error('Camera error:', err);
    }
  }, []);

  // Load COCO-SSD model
  useEffect(() => {
    const loadModel = async () => {
      try {
        setIsLoading(true);

        if (window.cocoSsd) {
          const loadedModel = await window.cocoSsd.load();
          setModel(loadedModel);
          await initCamera();
          setIsLoading(false);
        } else {
          setTimeout(() => {
            if (window.cocoSsd) {
              loadModel();
            } else {
              setError('TensorFlow.js COCO-SSD failed to load. Please refresh the page.');
            }
          }, 1000);
        }
      } catch (err) {
        setError('Failed to initialize the detection system. Please refresh the page.');
        console.error('Model loading error:', err);
      }
    };

    loadModel();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [initCamera]);

  // Capture snapshot
  const captureSnapshot = useCallback((): string => {
    if (!canvasRef.current || !videoRef.current) return '';

    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.8);
    }
    return '';
  }, []);

  // Draw bounding boxes
  const drawDetections = useCallback((predictions: DetectedObject[]) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    predictions.forEach((prediction, index) => {
      const [x, y, width, height] = prediction.bbox;

      // Animated glow effect
      const hue = (index * 60) % 360;
      ctx.shadowBlur = 20;
      ctx.shadowColor = `hsla(${hue}, 100%, 50%, 0.8)`;

      // Draw bounding box
      ctx.strokeStyle = `hsla(${hue}, 100%, 50%, 0.9)`;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Draw label background
      const label = `${prediction.class} ${(prediction.score * 100).toFixed(0)}%`;
      ctx.font = 'bold 16px Inter, sans-serif';
      const textWidth = ctx.measureText(label).width;

      ctx.fillStyle = `hsla(${hue}, 100%, 50%, 0.9)`;
      ctx.fillRect(x, y - 30, textWidth + 16, 28);

      // Draw label text
      ctx.fillStyle = '#000';
      ctx.shadowBlur = 0;
      ctx.fillText(label, x + 8, y - 10);
    });
  }, []);

  // Main detection loop
  const detect = useCallback(async () => {
    if (!model || !videoRef.current || !isDetecting) return;

    try {
      const predictions: DetectedObject[] = await model.detect(videoRef.current);

      // Filter by confidence threshold
      const filteredPredictions = predictions.filter(p => p.score > 0.5);

      // Draw bounding boxes
      drawDetections(filteredPredictions);

      // Update current objects
      const objectLabels = filteredPredictions.map(p => p.class);
      setCurrentObjects(objectLabels);

      // Check for new detections (cooldown: 10 seconds)
      const now = Date.now();
      const newDetections: typeof filteredPredictions = [];

      filteredPredictions.forEach(prediction => {
        const lastTime = lastDetectionTime.current.get(prediction.class) || 0;
        if (now - lastTime > 10000) { // 10 second cooldown
          newDetections.push(prediction);
          lastDetectionTime.current.set(prediction.class, now);
        }
      });

      // Create snapshot for new detections
      if (newDetections.length > 0) {
        const snapshot = captureSnapshot();
        const detectionData: Detection = {
          id: `${now}-${Math.random()}`,
          timestamp: now,
          objects: newDetections.map(p => ({
            label: p.class,
            confidence: p.score,
            bbox: p.bbox
          })),
          imageData: snapshot,
          explanation: generateExplanation(newDetections.map(p => ({
            label: p.class,
            confidence: p.score
          })))
        };

        setDetections(prev => [detectionData, ...prev]);
      }
    } catch (err) {
      console.error('Detection error:', err);
    }

    animationFrameId.current = requestAnimationFrame(detect);
  }, [model, isDetecting, drawDetections, captureSnapshot, generateExplanation]);

  // Start/stop detection
  useEffect(() => {
    if (isDetecting && model) {
      detect();
    } else if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [isDetecting, model, detect]);

  // Auto-start detection when model is loaded
  useEffect(() => {
    if (model && !isLoading) {
      setIsDetecting(true);
    }
  }, [model, isLoading]);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-8 max-w-md backdrop-blur-xl">
          <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Error</h2>
          <p className="text-red-200">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white">
      {/* Header */}
      <header className="border-b border-white/10 backdrop-blur-xl bg-black/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
              <Camera className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                AI Vision
              </h1>
              <p className="text-xs text-gray-400">Real-time Object Recognition</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {isDetecting && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-full">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-300">Active</span>
              </div>
            )}
            <button
              onClick={() => setIsDetecting(!isDetecting)}
              className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full font-medium hover:shadow-lg hover:shadow-cyan-500/50 transition-all duration-300"
            >
              {isDetecting ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50">
          <div className="text-center">
            <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mx-auto mb-4" />
            <p className="text-xl font-medium">Initializing AI Vision System...</p>
            <p className="text-gray-400 mt-2">Loading neural network models</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 lg:p-6">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Video Feed */}
          <div className="space-y-4">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Zap className="w-5 h-5 text-cyan-400" />
                  Live Detection Feed
                </h2>
                {currentObjects.length > 0 && (
                  <span className="text-sm text-gray-400">
                    {currentObjects.length} object{currentObjects.length !== 1 ? 's' : ''} detected
                  </span>
                )}
              </div>

              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                />
              </div>

              {/* Current Objects */}
              {currentObjects.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {[...new Set(currentObjects)].map((obj, idx) => (
                    <span
                      key={`${obj}-${idx}`}
                      className="px-3 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-full text-sm font-medium text-cyan-300 animate-pulse"
                    >
                      {obj}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Detection Dashboard */}
          <div className="space-y-4">
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Detection History
              </h2>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {detections.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No objects detected yet</p>
                    <p className="text-sm mt-1">AI is actively scanning...</p>
                  </div>
                ) : (
                  detections.map((detection, index) => (
                    <div
                      key={detection.id}
                      className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10 rounded-xl p-4 hover:border-cyan-500/50 transition-all duration-300 animate-fadeIn"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <img
                        src={detection.imageData}
                        alt="Detection snapshot"
                        className="w-full rounded-lg mb-3 border border-white/10"
                      />

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>{formatTime(detection.timestamp)}</span>
                          <span>{detection.objects.length} object{detection.objects.length !== 1 ? 's' : ''}</span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {detection.objects.map((obj, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/50 rounded-md text-xs font-medium text-cyan-300"
                            >
                              {obj.label} {(obj.confidence * 100).toFixed(0)}%
                            </span>
                          ))}
                        </div>

                        <p className="text-sm text-gray-300 leading-relaxed">
                          {detection.explanation}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out forwards;
        }

        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }

        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </div>
  );
}

export default App;
