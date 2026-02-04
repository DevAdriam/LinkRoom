import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import io, { Socket } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import { getSocketUrl } from "../utils/getSocketUrl";

const SOCKET_URL = getSocketUrl();

interface TransportData {
  id: string;
  iceParameters: any;
  iceCandidates: any[];
  dtlsParameters: any;
}

interface ProducerData {
  producerId: string;
  peerId: string;
  kind: string;
}

function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [remoteVideos, setRemoteVideos] = useState<Map<string, MediaStream>>(
    new Map()
  );
  const [roomLink, setRoomLink] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<mediasoupClient.types.Device | null>(null);
  const sendTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupClient.types.Transport | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const producersRef = useRef<Map<string, mediasoupClient.types.Producer>>(
    new Map()
  );
  const consumersRef = useRef<Map<string, mediasoupClient.types.Consumer>>(
    new Map()
  );
  const peerIdRef = useRef<string>("");

  useEffect(() => {
    if (!roomId) {
      navigate("/");
      return;
    }

    setRoomLink(`${window.location.origin}/room/${roomId}`);
    initializeRoom();

    return () => {
      cleanup();
    };
  }, [roomId, navigate]);

  const initializeRoom = async () => {
    try {
      const socket = io(SOCKET_URL);
      socketRef.current = socket;

      socket.on("connect", async () => {
        console.log("Connected to server");
        setIsConnected(true);
        await joinRoom(socket);
      });

      socket.on("disconnect", () => {
        console.log("Disconnected from server");
        setIsConnected(false);
      });

      socket.on("joinedRoom", async (data: any) => {
        console.log("Joined room response:", data);
        peerIdRef.current = data.peerId || data.data?.peerId;
        const routerRtpCapabilities =
          data.routerRtpCapabilities || data.data?.routerRtpCapabilities;
        const existingProducers =
          data.existingProducers || data.data?.existingProducers || [];

        if (!routerRtpCapabilities) {
          console.error("No router RTP capabilities received");
          alert("Failed to get server capabilities. Please try again.");
          return;
        }

        await initializeMediasoup(routerRtpCapabilities, existingProducers);
      });

      socket.on("newProducer", async (data: ProducerData) => {
        await handleNewProducer(data);
      });

      socket.on("error", (error: any) => {
        console.error("Socket error:", error);
        const errorMessage =
          error.message ||
          error.data?.message ||
          "Connection error. Please try again.";
        alert(errorMessage);
      });

      // Add error handler for transport creation
      socket.on("transportError", (error: any) => {
        console.error("Transport error:", error);
        alert("Failed to create transport. Please refresh the page.");
      });
    } catch (error) {
      console.error("Error initializing room:", error);
      alert("Failed to join room. Please try again.");
    }
  };

  const joinRoom = async (socket: Socket) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create a temporary device to get rtpCapabilities
      const tempDevice = new mediasoupClient.Device();
      // We'll load it properly after getting routerRtpCapabilities
      deviceRef.current = tempDevice;

      socket.emit("joinRoom", {
        roomId,
        rtpCapabilities: null, // Will send after device loads
      });
    } catch (error) {
      console.error("Error getting user media:", error);
      alert("Failed to access camera/microphone. Please check permissions.");
    }
  };

  const initializeMediasoup = async (
    routerRtpCapabilities: any,
    existingProducers: ProducerData[]
  ) => {
    if (!deviceRef.current || !socketRef.current) return;

    try {
      const device = deviceRef.current;
      await device.load({ routerRtpCapabilities });

      // Now send our rtpCapabilities to the server
      socketRef.current.emit("updateRtpCapabilities", {
        roomId,
        peerId: peerIdRef.current,
        rtpCapabilities: device.rtpCapabilities,
      });

      // Create send transport - set up listener BEFORE emitting
      socketRef.current.once(
        "transportCreated:send",
        async (data: TransportData) => {
          console.log("Send transport created:", data);
          const sendTransport = device.createSendTransport({
            id: data.id,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
          });

          sendTransport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                socketRef.current?.emit("connectTransport", {
                  roomId,
                  peerId: peerIdRef.current,
                  transportId: sendTransport.id,
                  dtlsParameters,
                });
                socketRef.current?.once("transportConnected", () => {
                  callback();
                });
              } catch (error) {
                errback(error as Error);
              }
            }
          );

          sendTransport.on(
            "produce",
            async ({ kind, rtpParameters }, callback, errback) => {
              try {
                socketRef.current?.emit("produce", {
                  roomId,
                  peerId: peerIdRef.current,
                  transportId: sendTransport.id,
                  kind,
                  rtpParameters,
                });
                socketRef.current?.once("produced", (data: any) => {
                  callback({ id: data.producerId || data.data?.producerId });
                });
              } catch (error) {
                errback(error as Error);
              }
            }
          );

          sendTransportRef.current = sendTransport;
          await produceMedia(sendTransport);
        }
      );

      // Now emit after listener is set up
      socketRef.current.emit("createTransport", {
        roomId,
        peerId: peerIdRef.current,
        direction: "send",
      });

      // Create recv transport - set up listener BEFORE emitting
      socketRef.current.once(
        "transportCreated:recv",
        async (data: TransportData) => {
          console.log("Recv transport created:", data);
          const recvTransport = device.createRecvTransport({
            id: data.id,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
          });

          recvTransport.on(
            "connect",
            async ({ dtlsParameters }, callback, errback) => {
              try {
                socketRef.current?.emit("connectTransport", {
                  roomId,
                  peerId: peerIdRef.current,
                  transportId: recvTransport.id,
                  dtlsParameters,
                });
                socketRef.current?.once("transportConnected", () => {
                  callback();
                });
              } catch (error) {
                errback(error as Error);
              }
            }
          );

          recvTransportRef.current = recvTransport;

          // Consume existing producers
          console.log("Consuming existing producers:", existingProducers);
          // Group producers by peer to avoid duplicates
          const producersByPeer = new Map<string, ProducerData[]>();
          for (const producer of existingProducers) {
            if (!producersByPeer.has(producer.peerId)) {
              producersByPeer.set(producer.peerId, []);
            }
            producersByPeer.get(producer.peerId)!.push(producer);
          }

          // Consume one video producer per peer
          producersByPeer.forEach(
            (producers: ProducerData[], peerId: string) => {
              // Don't consume our own producers
              if (peerId === peerIdRef.current) {
                return;
              }
              // Find video producer for this peer
              const videoProducer = producers.find(
                (p: ProducerData) => p.kind === "video"
              );
              if (videoProducer) {
                consumeProducer(recvTransport, videoProducer.producerId);
              }
            }
          );
        }
      );

      // Now emit after listener is set up
      socketRef.current.emit("createTransport", {
        roomId,
        peerId: peerIdRef.current,
        direction: "recv",
      });
    } catch (error) {
      console.error("Error initializing mediasoup:", error);
      alert("Failed to initialize video connection. Please refresh the page.");
    }
  };

  const produceMedia = async (transport: mediasoupClient.types.Transport) => {
    if (!localStreamRef.current) return;

    try {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      const audioTrack = localStreamRef.current.getAudioTracks()[0];

      if (videoTrack) {
        const videoProducer = await transport.produce({ track: videoTrack });
        producersRef.current.set("video", videoProducer);
      }

      if (audioTrack) {
        const audioProducer = await transport.produce({ track: audioTrack });
        producersRef.current.set("audio", audioProducer);
      }
    } catch (error) {
      console.error("Error producing media:", error);
    }
  };

  const consumeProducer = async (
    transport: mediasoupClient.types.Transport,
    producerId: string
  ) => {
    if (!socketRef.current || !transport) return;

    // Don't consume if we already have this consumer
    if (consumersRef.current.has(producerId)) {
      console.log("Already consuming producer:", producerId);
      return;
    }

    try {
      // Use a unique event name for each consume request
      const consumeEventId = `consumed:${producerId}`;

      socketRef.current.emit("consume", {
        roomId,
        peerId: peerIdRef.current,
        transportId: transport.id,
        producerId,
      });

      // Use a promise-based approach to handle the response
      const consumePromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout waiting for consume response for producer ${producerId}`
            )
          );
        }, 10000);

        const handler = (response: any) => {
          const data = response.data || response;

          // Verify this is the response for the producer we requested
          if (data.producerId === producerId) {
            clearTimeout(timeout);
            socketRef.current?.off("consumed", handler);
            resolve(data);
          } else {
            // Not our response, keep listening
            console.log(
              "Received consume response for different producer, waiting..."
            );
          }
        };

        socketRef.current?.on("consumed", handler);
      });

      try {
        const data = await consumePromise;
        const consumer = await transport.consume({
          id: data.id,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters,
        });

        consumersRef.current.set(producerId, consumer);

        // Create or update stream for this producer
        setRemoteVideos((prev) => {
          const newMap = new Map(prev);
          // Create new stream for this producer
          const stream = new MediaStream([consumer.track]);
          newMap.set(producerId, stream);
          return newMap;
        });

        console.log(
          "Successfully consumed producer:",
          producerId,
          "kind:",
          data.kind
        );
      } catch (consumeError) {
        console.error("Error consuming producer:", consumeError);
      }
    } catch (error) {
      console.error("Error consuming producer:", error);
    }
  };

  const handleNewProducer = async (data: ProducerData) => {
    console.log("New producer received:", data);
    // Don't consume our own producers
    if (data.peerId === peerIdRef.current) {
      console.log("Ignoring own producer");
      return;
    }
    // Only consume video producers
    if (data.kind === "video" && recvTransportRef.current) {
      await consumeProducer(recvTransportRef.current, data.producerId);
    }
  };

  const toggleVideo = async () => {
    const videoProducer = producersRef.current.get("video");
    if (videoProducer) {
      if (isVideoEnabled) {
        videoProducer.pause();
      } else {
        videoProducer.resume();
      }
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  const toggleAudio = async () => {
    const audioProducer = producersRef.current.get("audio");
    if (audioProducer) {
      if (isAudioEnabled) {
        audioProducer.pause();
      } else {
        audioProducer.resume();
      }
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const copyRoomLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const leaveRoom = () => {
    cleanup();
    navigate("/");
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    producersRef.current.forEach((producer) => producer.close());
    consumersRef.current.forEach((consumer) => consumer.close());

    if (sendTransportRef.current) {
      sendTransportRef.current.close();
    }
    if (recvTransportRef.current) {
      recvTransportRef.current.close();
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header - Mobile Optimized */}
        <div className="bg-white/10 backdrop-blur-lg rounded-xl p-3 sm:p-6 mb-3 sm:mb-4 shadow-xl border border-white/20">
          {/* Room Code Section */}
          <div className="mb-3 sm:mb-4">
            <label className="text-white/80 text-xs font-medium mb-1.5 sm:mb-2 block">
              Room Code
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <div className="flex-1 bg-white/20 backdrop-blur-sm rounded-lg px-3 py-2.5 sm:px-4 sm:py-3 border border-white/30 overflow-hidden">
                <code className="text-white font-mono text-xs sm:text-sm font-semibold break-all">
                  {roomId}
                </code>
              </div>
              <button
                onClick={copyRoomCode}
                className={`px-3 py-2.5 sm:px-4 sm:py-3 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  copiedCode
                    ? "bg-green-500 text-white"
                    : "bg-white/20 active:bg-white/30 text-white border border-white/30"
                }`}
              >
                {copiedCode ? (
                  <>
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4 sm:w-5 sm:h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Copy Code</span>
                    <span className="sm:hidden">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Status and Leave Button */}
          <div className="flex items-center justify-between gap-2 mb-3 sm:mb-4">
            <div
              className={`px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 sm:gap-2 ${
                isConnected
                  ? "bg-green-500/20 text-green-200 border border-green-400/30"
                  : "bg-red-500/20 text-red-200 border border-red-400/30"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${
                  isConnected ? "bg-green-400" : "bg-red-400"
                }`}
              ></div>
              <span className="hidden sm:inline">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
              <span className="sm:hidden">{isConnected ? "On" : "Off"}</span>
            </div>
            <button
              onClick={leaveRoom}
              className="px-3 py-2 sm:px-4 sm:py-2 bg-red-500 active:bg-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg transition-colors shadow-lg"
            >
              Leave
            </button>
          </div>

          {/* Share Link Section */}
          <div>
            <label className="text-white/80 text-xs font-medium mb-1.5 sm:mb-2 block">
              Share Link
            </label>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={roomLink}
                readOnly
                className="flex-1 bg-white/20 backdrop-blur-sm text-white text-xs rounded-lg px-3 py-2 sm:px-4 sm:py-2.5 border border-white/30 focus:outline-none focus:border-white/50 font-mono truncate"
              />
              <button
                onClick={copyRoomLink}
                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg font-semibold text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                  copied
                    ? "bg-green-500 text-white"
                    : "bg-white/20 active:bg-white/30 text-white border border-white/30"
                }`}
              >
                {copied ? (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <span className="hidden sm:inline">Copy Link</span>
                    <span className="sm:hidden">Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
          {/* Local Video */}
          <div className="relative bg-black rounded-lg sm:rounded-xl overflow-hidden aspect-video shadow-xl sm:shadow-2xl border border-white/20 sm:border-2">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full"></div>
              <span>You</span>
            </div>
            {!isVideoEnabled && (
              <div className="absolute inset-0 bg-gray-900/90 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center">
                  <svg
                    className="w-8 h-8 sm:w-12 sm:h-12 mx-auto text-white/50 mb-1 sm:mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span className="text-white text-xs sm:text-sm font-medium">
                    Video Off
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Remote Videos */}
          {Array.from(remoteVideos.entries()).map(([producerId, stream]) => (
            <div
              key={producerId}
              className="relative bg-black rounded-lg sm:rounded-xl overflow-hidden aspect-video shadow-xl sm:shadow-2xl border border-white/20 sm:border-2"
            >
              <video
                autoPlay
                playsInline
                ref={(videoElement) => {
                  if (videoElement && videoElement.srcObject !== stream) {
                    videoElement.srcObject = stream;
                  }
                }}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 sm:bottom-3 sm:left-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-md sm:rounded-lg text-xs font-semibold flex items-center gap-1.5 sm:gap-2">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-400 rounded-full animate-pulse"></div>
                <span>Participant</span>
              </div>
            </div>
          ))}
        </div>

        {/* Controls - Mobile Optimized */}
        <div className="bg-white/10 backdrop-blur-lg rounded-lg sm:rounded-xl p-3 sm:p-6 shadow-xl border border-white/20">
          <div className="flex items-center justify-center gap-3 sm:gap-6">
            <button
              onClick={toggleVideo}
              className={`p-3 sm:p-4 md:p-5 rounded-full transition-all duration-200 shadow-lg active:scale-95 sm:hover:scale-110 touch-manipulation ${
                isVideoEnabled
                  ? "bg-white/20 active:bg-white/30 text-white border-2 border-white/30"
                  : "bg-red-500 active:bg-red-600 text-white border-2 border-red-400"
              }`}
              title={isVideoEnabled ? "Turn off camera" : "Turn on camera"}
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isVideoEnabled ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                )}
              </svg>
            </button>

            <button
              onClick={toggleAudio}
              className={`p-3 sm:p-4 md:p-5 rounded-full transition-all duration-200 shadow-lg active:scale-95 sm:hover:scale-110 touch-manipulation ${
                isAudioEnabled
                  ? "bg-white/20 active:bg-white/30 text-white border-2 border-white/30"
                  : "bg-red-500 active:bg-red-600 text-white border-2 border-red-400"
              }`}
              title={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
            >
              <svg
                className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {isAudioEnabled ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Room;
