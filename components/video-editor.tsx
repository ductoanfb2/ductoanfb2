"use client"

import type React from "react"

import { useState, useRef, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Upload, Play, Pause, Download, Settings, FlipHorizontal, X, Sparkles, Video, Zap, Volume2, VolumeX, Maximize, RotateCcw, RotateCw } from "lucide-react"

interface VideoSettings {
  resolution: "720p" | "1080p" | "4K"
  mirrored: boolean
  outroVideo?: File
}

interface VideoFile {
  file: File
  url: string
  processedUrl?: string
  isProcessing?: boolean
  progress?: number
}

export default function VideoEditor() {
  const [videoFiles, setVideoFiles] = useState<VideoFile[]>([])
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [settings, setSettings] = useState<VideoSettings>({
    resolution: "1080p",
    mirrored: false,
  })

  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const outroInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newVideoFiles: VideoFile[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        if (file.type.startsWith("video/")) {
          newVideoFiles.push({
            file,
            url: URL.createObjectURL(file),
          })
        }
      }
      setVideoFiles((prev) => [...prev, ...newVideoFiles])
    }
    // Reset input để có thể chọn cùng file lần nữa
    if (event.target) {
      event.target.value = ''
    }
  }, [])

  const removeVideo = useCallback(
    (index: number) => {
      setVideoFiles((prev) => {
        const newFiles = prev.filter((_, i) => i !== index)
        if (currentVideoIndex >= newFiles.length && newFiles.length > 0) {
          setCurrentVideoIndex(newFiles.length - 1)
        } else if (newFiles.length === 0) {
          setCurrentVideoIndex(0)
        }
        return newFiles
      })
    },
    [currentVideoIndex],
  )

  const handleOutroUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith("video/")) {
      setSettings(prev => ({ ...prev, outroVideo: file }))
    }
    // Reset input
    if (event.target) {
      event.target.value = ''
    }
  }, [])

  const removeOutroVideo = useCallback(() => {
    setSettings(prev => ({ ...prev, outroVideo: undefined }))
  }, [])

  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }, [isPlaying])

  const processVideo = useCallback(
    async (videoIndex: number) => {
      if (!videoFiles[videoIndex]) return

      setVideoFiles((prev) =>
        prev.map((video, i) => (i === videoIndex ? { ...video, isProcessing: true, progress: 0 } : video)),
      )

      try {
        const formData = new FormData()
        formData.append('video', videoFiles[videoIndex].file)
        formData.append('resolution', settings.resolution)
        formData.append('mirrored', settings.mirrored.toString())
        
        // Thêm outro video nếu có
        if (settings.outroVideo) {
          formData.append('outroVideo', settings.outroVideo)
        }

        const response = await fetch('/api/process-video', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          throw new Error('Failed to process video')
        }

        // Tạo progress tracking
        const progressInterval = setInterval(() => {
          setVideoFiles((prev) =>
            prev.map((video, i) =>
              i === videoIndex
                ? {
                    ...video,
                    progress: Math.min((video.progress || 0) + 5, 95),
                  }
                : video,
            ),
          )
        }, 500)

        const blob = await response.blob()
        clearInterval(progressInterval)

        const processedUrl = URL.createObjectURL(blob)
        setVideoFiles((prev) =>
          prev.map((video, i) =>
            i === videoIndex
              ? {
                  ...video,
                  processedUrl,
                  isProcessing: false,
                  progress: 100,
                }
              : video,
          ),
        )
      } catch (error) {
        console.error('Error processing video:', error)
        setVideoFiles((prev) =>
          prev.map((video, i) =>
            i === videoIndex
              ? {
                  ...video,
                  isProcessing: false,
                  progress: 0,
                }
              : video,
          ),
        )
        alert('Có lỗi xảy ra khi xử lý video. Vui lòng thử lại.')
      }
    },
    [settings, videoFiles],
  )

  const processAllVideos = useCallback(async () => {
    for (let i = 0; i < videoFiles.length; i++) {
      if (!videoFiles[i].processedUrl) {
        setCurrentVideoIndex(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
        await processVideo(i)
      }
    }
  }, [videoFiles, processVideo])

  const downloadVideo = useCallback(
    (videoIndex: number) => {
      const video = videoFiles[videoIndex]
      if (video?.processedUrl) {
        const a = document.createElement("a")
        a.href = video.processedUrl
        a.download = `video_edited_${settings.resolution}_${Date.now()}.mp4`
        a.setAttribute("download", a.download)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
    },
    [videoFiles, settings.resolution],
  )

  const downloadAllVideos = useCallback(() => {
    const processedVideos = videoFiles.filter(video => video.processedUrl)
    
    if (processedVideos.length === 0) {
      alert('Không có video nào đã được xử lý để download!')
      return
    }

    // Download từng video với delay nhỏ để tránh browser block
    processedVideos.forEach((video, index) => {
      setTimeout(() => {
        const a = document.createElement("a")
        a.href = video.processedUrl!
        a.download = `video_edited_${settings.resolution}_${index + 1}_${Date.now()}.mp4`
        a.setAttribute("download", a.download)
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }, index * 500) // Delay 500ms giữa mỗi download
    })
  }, [videoFiles, settings.resolution])

  const handleAddMoreVideos = useCallback(() => {
    console.log('handleAddMoreVideos called')
    if (fileInputRef.current) {
      console.log('Triggering file input click')
      fileInputRef.current.click()
    } else {
      console.error('fileInputRef is null')
    }
  }, [])

  const currentVideo = videoFiles[currentVideoIndex]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-cyan-50">
      {/* Input file luôn được render ở đây */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        multiple
        onChange={handleFileUpload}
        className="hidden"
        style={{ display: 'none' }}
      />
      
      {/* Input file cho outro video */}
      <input
        ref={outroInputRef}
        type="file"
        accept="video/*"
        onChange={handleOutroUpload}
        className="hidden"
        style={{ display: 'none' }}
      />
      
      <div className="relative overflow-hidden bg-gradient-to-r from-cyan-600 via-blue-600 to-emerald-600 text-white">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative container mx-auto px-4 py-8 sm:py-12 md:py-16 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/20 rounded-full backdrop-blur-sm">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-xs sm:text-sm font-medium">Video Editor</span>
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-cyan-100 bg-clip-text text-transparent">
            Video Editor Pro
          </h1>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
      </div>

      <div className="container mx-auto p-3 sm:p-4 md:p-6 max-w-7xl -mt-4 sm:-mt-6 md:-mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          <Card className="lg:col-span-2 glass-card hover-lift border-0 shadow-2xl">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl md:text-2xl">
                <div className="p-1.5 sm:p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg text-white">
                  <Upload className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
                </div>
                Upload Videos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {videoFiles.length === 0 ? (
                <div
                  className="relative border-2 border-dashed border-cyan-300 rounded-2xl p-8 sm:p-12 md:p-16 text-center cursor-pointer hover:border-cyan-400 transition-all duration-300 bg-gradient-to-br from-cyan-50/50 to-blue-50/50 hover:from-cyan-100/50 hover:to-blue-100/50 group"
                  onClick={handleAddMoreVideos}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                  <div className="relative">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white group-hover:scale-110 transition-transform duration-300">
                      <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <h3 className="text-lg sm:text-xl md:text-2xl font-bold mb-2 sm:mb-3 text-gray-800">Kéo thả video vào đây</h3>
                    <p className="text-sm sm:text-base md:text-lg text-gray-600">hoặc click để chọn nhiều file cùng lúc</p>
                    <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3 sm:w-4 sm:h-4" />
                        MP4, MOV, AVI
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                        Tối đa 100MB
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 mb-4 sm:mb-6">
                    {videoFiles.map((video, index) => (
                      <div
                        key={index}
                        className={`relative group cursor-pointer transition-all duration-300 hover-lift ${
                          currentVideoIndex === index
                            ? "ring-2 ring-cyan-500 ring-offset-1 sm:ring-offset-2 ring-offset-white"
                            : "hover:ring-2 hover:ring-cyan-300 hover:ring-offset-1 sm:hover:ring-offset-2 hover:ring-offset-white"
                        }`}
                        onClick={() => setCurrentVideoIndex(index)}
                      >
                        <div className="gradient-border">
                          <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg sm:rounded-xl overflow-hidden">
                            <video src={video.url} className="w-full h-full object-cover" muted />
                            {currentVideoIndex === index && (
                              <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/20 to-transparent"></div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 sm:mt-2 px-1 sm:px-2">
                          <p className="text-xs font-medium truncate text-gray-700">{video.file.name}</p>
                        </div>

                        {video.isProcessing && (
                          <div className="absolute inset-0 bg-black/60 rounded-lg sm:rounded-xl flex items-center justify-center backdrop-blur-sm">
                            <div className="text-center text-white">
                              <div className="w-6 h-6 sm:w-8 sm:h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-1 sm:mb-2"></div>
                              <div className="text-xs sm:text-sm font-medium">{video.progress}%</div>
                            </div>
                          </div>
                        )}

                        {video.processedUrl && (
                          <div className="absolute top-1 sm:top-2 right-1 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                        )}

                        <Button
                          size="sm"
                          variant="destructive"
                          className="absolute top-1 sm:top-2 left-1 sm:left-2 w-5 h-5 sm:w-6 sm:h-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation()
                            removeVideo(index)
                          }}
                        >
                          <X className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {currentVideo && (
                    <MainVideoPlayer
                      video={currentVideo}
                      videoRef={videoRef}
                      isPlaying={isPlaying}
                      setIsPlaying={setIsPlaying}
                      currentVideoIndex={currentVideoIndex}
                      videoFilesLength={videoFiles.length}
                    />
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Button
                      onClick={handleAddMoreVideos}
                      variant="outline"
                      disabled={videoFiles.some(v => v.isProcessing)}
                      className="bg-white/80 hover:bg-white border-cyan-200 hover:border-cyan-300 text-cyan-700 hover:text-cyan-800 hover-lift text-sm sm:text-base"
                    >
                      <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Thêm video
                    </Button>
                    <Button
                      onClick={() => processVideo(currentVideoIndex)}
                      disabled={currentVideo?.isProcessing}
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white shadow-lg hover-lift disabled:opacity-50 text-sm sm:text-base"
                    >
                      <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Xử lý video này
                    </Button>
                    <Button
                      onClick={processAllVideos}
                      disabled={videoFiles.some(v => v.isProcessing)}
                      className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white shadow-lg hover-lift disabled:opacity-50 text-sm sm:text-base"
                    >
                      <Zap className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Xử lý tất cả
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="glass-card hover-lift border-0 shadow-2xl">
            <CardHeader className="pb-4 sm:pb-6">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                <div className="p-1.5 sm:p-2 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg text-white">
                  <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                Cài đặt
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 sm:space-y-8">
              <div className="space-y-3 sm:space-y-4">
                <Label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2">
                  <Video className="w-3 h-3 sm:w-4 sm:h-4" />
                  Độ phân giải
                </Label>
                <div className="grid grid-cols-3 gap-1 sm:gap-2">
                  {(["720p", "1080p", "4K"] as const).map((res) => (
                    <Button
                      key={res}
                      variant={settings.resolution === res ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSettings((prev) => ({ ...prev, resolution: res }))}
                      className={`text-xs sm:text-sm ${
                        settings.resolution === res
                          ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg hover-lift"
                          : "bg-white/80 hover:bg-white border-gray-200 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 hover-lift"
                      }`}
                    >
                      {res}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <Label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2">
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  Hiệu ứng
                </Label>
                <Button
                  variant={settings.mirrored ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSettings((prev) => ({ ...prev, mirrored: !prev.mirrored }))}
                  className={`w-full flex items-center justify-center gap-1 sm:gap-2 transition-all duration-300 text-xs sm:text-sm ${
                    settings.mirrored
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-lg pulse-glow"
                      : "bg-white/80 hover:bg-white border-gray-200 hover:border-emerald-300 text-gray-700 hover:text-emerald-700"
                  } hover-lift`}
                >
                  <FlipHorizontal className="w-3 h-3 sm:w-4 sm:h-4" />
                  {settings.mirrored ? "Đã lật ngược" : "Lật ngược video"}
                </Button>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <Label className="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-1 sm:gap-2">
                  <Video className="w-3 h-3 sm:w-4 sm:h-4" />
                  Video Outro
                </Label>
                {!settings.outroVideo ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => outroInputRef.current?.click()}
                    className="w-full bg-white/80 hover:bg-white border-gray-200 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 hover-lift text-xs sm:text-sm"
                  >
                    <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Thêm video outro
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Video className="w-4 h-4 text-gray-600 flex-shrink-0" />
                        <span 
                          className="text-xs sm:text-sm font-medium text-gray-700 truncate"
                          title={settings.outroVideo.name}
                        >
                          {settings.outroVideo.name}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={removeOutroVideo}
                        className="w-6 h-6 p-0 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 flex-shrink-0 ml-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => outroInputRef.current?.click()}
                      className="w-full bg-white/80 hover:bg-white border-gray-200 hover:border-cyan-300 text-gray-700 hover:text-cyan-700 hover-lift text-xs sm:text-sm"
                    >
                      <Upload className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                      Thay đổi outro
                    </Button>
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Video outro sẽ được ghép vào cuối video chính (không bị ảnh hưởng bởi hiệu ứng lật)
                </p>
              </div>
            </CardContent>
          </Card>

          {videoFiles.some((video) => video.processedUrl) && (
            <Card className="lg:col-span-3 glass-card hover-lift border-0 shadow-2xl">
              <CardHeader className="pb-4 sm:pb-6">
                <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                  <div className="p-1.5 sm:p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg text-white">
                    <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  Video đã xử lý ({videoFiles.filter((v) => v.processedUrl).length}/{videoFiles.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                  {videoFiles.map(
                    (video, index) =>
                      video.processedUrl && (
                        <ProcessedVideoPlayer
                          key={index}
                          video={video}
                          index={index}
                          onDownload={downloadVideo}
                        />
                      ),
                  )}
                </div>
                <div className="mt-4 sm:mt-6 flex justify-end">
                  <Button
                    onClick={downloadAllVideos}
                    disabled={videoFiles.filter(v => v.processedUrl).length === 0}
                    className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover-lift disabled:opacity-50 text-sm sm:text-base"
                  >
                    <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                    Tải xuống tất cả
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

// Component cho video player chính (preview)
function MainVideoPlayer({ 
  video, 
  videoRef, 
  isPlaying, 
  setIsPlaying, 
  currentVideoIndex, 
  videoFilesLength 
}: { 
  video: VideoFile
  videoRef: React.RefObject<HTMLVideoElement>
  isPlaying: boolean
  setIsPlaying: (playing: boolean) => void
  currentVideoIndex: number
  videoFilesLength: number
}) {
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value)
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newVolume = parseFloat(e.target.value)
      videoRef.current.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const toggleFullscreen = async () => {
    if (containerRef.current) {
      try {
        if (!isFullscreen) {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen()
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            await (containerRef.current as any).webkitRequestFullscreen()
          } else if ((containerRef.current as any).msRequestFullscreen) {
            await (containerRef.current as any).msRequestFullscreen()
          }
          setIsFullscreen(true)
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen()
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen()
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen()
          }
          setIsFullscreen(false)
        }
      } catch (error) {
        console.error('Fullscreen error:', error)
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl sm:rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
      }`}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      <video
        ref={videoRef}
        src={video.url}
        className={`w-full h-auto object-contain transition-all duration-300 ${
          isFullscreen ? 'h-screen max-h-none' : 'max-h-64 sm:max-h-80 md:max-h-96'
        }`}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      
      {/* Custom Controls */}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
        {/* Top Controls */}
        <div className="absolute top-2 sm:top-4 right-2 sm:right-4 flex gap-1 sm:gap-2">
          <div className="px-2 py-1 sm:px-3 sm:py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs sm:text-sm font-medium">
            {currentVideoIndex + 1} / {videoFilesLength}
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 space-y-2 sm:space-y-3">
          {/* Progress Bar */}
          <div className="w-full">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
              style={{
                background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`
              }}
            />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                size="sm"
                onClick={togglePlayPause}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
              >
                {isPlaying ? <Pause className="w-3 h-3 sm:w-4 sm:h-4" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4" />}
              </Button>
              
              <Button
                size="sm"
                onClick={() => skipTime(-10)}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
              >
                <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              
              <Button
                size="sm"
                onClick={() => skipTime(10)}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
              >
                <RotateCw className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>

              <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
                <Button
                  size="sm"
                  onClick={toggleMute}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                >
                  {isMuted ? <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" /> : <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                </Button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-12 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <div className="text-white text-xs sm:text-sm font-medium">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              <Button
                size="sm"
                onClick={toggleFullscreen}
                className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
              >
                <Maximize className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Component riêng cho video player đã xử lý
function ProcessedVideoPlayer({ video, index, onDownload }: { video: VideoFile; index: number; onDownload: (index: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showControls, setShowControls] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
    }
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = parseFloat(e.target.value)
      videoRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newVolume = parseFloat(e.target.value)
      videoRef.current.volume = newVolume
      setVolume(newVolume)
      setIsMuted(newVolume === 0)
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      if (isMuted) {
        videoRef.current.volume = volume
        setIsMuted(false)
      } else {
        videoRef.current.volume = 0
        setIsMuted(true)
      }
    }
  }

  const toggleFullscreen = async () => {
    if (containerRef.current) {
      try {
        if (!isFullscreen) {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen()
          } else if ((containerRef.current as any).webkitRequestFullscreen) {
            await (containerRef.current as any).webkitRequestFullscreen()
          } else if ((containerRef.current as any).msRequestFullscreen) {
            await (containerRef.current as any).msRequestFullscreen()
          }
          setIsFullscreen(true)
        } else {
          if (document.exitFullscreen) {
            await document.exitFullscreen()
          } else if ((document as any).webkitExitFullscreen) {
            await (document as any).webkitExitFullscreen()
          } else if ((document as any).msExitFullscreen) {
            await (document as any).msExitFullscreen()
          }
          setIsFullscreen(false)
        }
      } catch (error) {
        console.error('Fullscreen error:', error)
      }
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)
    document.addEventListener('mozfullscreenchange', handleFullscreenChange)
    document.addEventListener('MSFullscreenChange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange)
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange)
    }
  }, [])

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime += seconds
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="space-y-3 sm:space-y-4 group">
      <div 
        ref={containerRef}
        className={`relative bg-gradient-to-br from-gray-900 to-gray-800 rounded-lg sm:rounded-xl overflow-hidden shadow-lg hover-lift transition-all duration-300 ${
          isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''
        }`}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={video.processedUrl}
          className={`w-full h-auto object-contain transition-all duration-300 ${
            isFullscreen ? 'h-screen max-h-none' : 'max-h-32 sm:max-h-40 md:max-h-48'
          }`}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
        />
        
        {/* Custom Controls */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          {/* Bottom Controls */}
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 right-2 sm:right-4 space-y-2 sm:space-y-3">
            {/* Progress Bar */}
            <div className="w-full">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                style={{
                  background: `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.3) 100%)`
                }}
              />
            </div>

            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 sm:gap-2">
                <Button
                  size="sm"
                  onClick={togglePlayPause}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                >
                  {isPlaying ? <Pause className="w-3 h-3 sm:w-4 sm:h-4" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4" />}
                </Button>
                
                <Button
                  size="sm"
                  onClick={() => skipTime(-10)}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                >
                  <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                
                <Button
                  size="sm"
                  onClick={() => skipTime(10)}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                >
                  <RotateCw className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>

                <div className="flex items-center gap-1 sm:gap-2 ml-2 sm:ml-4">
                  <Button
                    size="sm"
                    onClick={toggleMute}
                    className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                  >
                    {isMuted ? <VolumeX className="w-3 h-3 sm:w-4 sm:h-4" /> : <Volume2 className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </Button>
                  
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-12 sm:w-16 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer slider"
                  />
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <div className="text-white text-xs sm:text-sm font-medium">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
                <Button
                  size="sm"
                  onClick={toggleFullscreen}
                  className="bg-black/50 hover:bg-black/70 backdrop-blur-sm border border-white/20 text-white hover-lift p-1.5 sm:p-2"
                >
                  <Maximize className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-1 sm:space-y-2">
        <p className="text-xs sm:text-sm font-medium truncate text-gray-700">{video.file.name}</p>
        <Button
          onClick={() => onDownload(index)}
          size="sm"
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg hover-lift text-xs sm:text-sm"
        >
          <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
          Lưu vào bộ sưu tập
        </Button>
      </div>
    </div>
  )
}
