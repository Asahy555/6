
import React, { useState, useEffect, useRef } from 'react';
import { Character, ChatSession, Message, Page, GalleryItem } from './types';
import { Button } from './components/Button';
import { generateImage, streamCharacterResponse, getPlotSummary, generateBackground, generateVideo, analyzeCharacterEvolution, generateSpeech } from './services/geminiService';
import { storage } from './services/storage';

// --- Utils ---

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fallback
    }
  }
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Image compression utility
const compressImage = (base64Str: string, maxWidth = 512, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > maxWidth || height > maxWidth) {
                if (width > height) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                } else {
                    width = Math.round((width * maxWidth) / height);
                    height = maxWidth;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            } else {
                resolve(base64Str);
            }
        };
        img.onerror = () => {
            console.warn("Image compression failed, using original.");
            resolve(base64Str);
        };
    });
};

// --- Icons ---
const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M5 12h14"/><path d="M12 5v14"/></svg>;
const ChatIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z"/></svg>;
const UsersIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const EditIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
const TrashIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const CameraIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
const VideoIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>;
const CheckIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="20 6 9 17 4 12"/></svg>;
const ArrowLeftIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m15 18-6-6 6-6"/></svg>;
const GalleryIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const SaveIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>;
const DownloadIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const ImageIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const SpeakerIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const MicIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>;
const StopIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
const CoinIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg>;
const PaperclipIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>;
const CloseIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const ScaleIcon = (props: React.SVGProps<SVGSVGElement>) => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 3v18"/><path d="M6 18h12"/><path d="M6 8h12"/></svg>;

// --- Helper Components ---

const MessageBubble: React.FC<{ 
  msg: Message; 
  characters: Character[]; 
  onSaveToGallery: (url: string, type: 'image' | 'video', caption: string) => void; 
}> = ({ msg, characters, onSaveToGallery }) => {
  const isUser = msg.senderId === 'user';
  const char = characters.find(c => c.id === msg.senderId);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'generating' | 'playing'>('idle');
  
  const borderColor = isUser ? 'border-blue-500' : (char?.color || 'border-gray-500');
  const alignClass = isUser ? 'justify-end' : 'justify-start';
  const bgClass = isUser ? 'bg-blue-900/40' : 'bg-gray-800/80';

  const handlePlayVoice = async () => {
    if (audioStatus !== 'idle' || !char) return;
    setAudioStatus('generating');
    try {
        const audioBuffer = await generateSpeech(msg.content, char.voice || 'Kore');
        if (audioBuffer) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            
            // Apply Voice Settings
            if (char.voiceSpeed) {
                source.playbackRate.value = char.voiceSpeed;
            }
            if (char.voicePitch) {
                // detune is in cents. 100 cents = 1 semitone.
                source.detune.value = char.voicePitch;
            }

            source.connect(ctx.destination);
            source.start();
            setAudioStatus('playing');
            source.onended = () => setAudioStatus('idle');
        } else {
            setAudioStatus('idle');
        }
    } catch (e) {
        console.error("Playback failed", e);
        setAudioStatus('idle');
    }
  };

  const renderContent = (text: string) => {
    if (text === '...' && !isUser) {
        return (
             <div className="flex space-x-1 h-6 items-center px-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
             </div>
        );
    }

    const parts = text.split(/(\*[^*]+\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('*') && part.endsWith('*')) {
        return <span key={i} className="action-text text-gray-500 italic text-xs block my-1">{part.replace(/\*/g, '')}</span>;
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Determine if we should show a skeleton loader for media
  const isMediaLoading = msg.isLoading && (msg.content.includes("Рисую") || msg.content.includes("Монтирую") || msg.content.includes("Генерирую"));

  return (
    <div className={`flex w-full mb-4 ${alignClass}`}>
      <div className={`max-w-[80%] md:max-w-[60%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {!isUser && char && (
          <div className="flex items-center gap-2 mb-1 ml-1">
             <img src={char.avatar} alt={char.name} className="w-6 h-6 rounded-full object-cover" />
             <span className="text-xs text-gray-400 font-bold" style={{ color: char.color }}>{char.name}</span>
          </div>
        )}
        <div className={`relative px-4 py-3 rounded-2xl border-l-4 ${borderColor} ${bgClass} backdrop-blur-md shadow-lg transition-all`}>
          {isMediaLoading ? (
             <div className="flex flex-col gap-2">
                 <div className="w-64 h-64 bg-gray-800 rounded-lg animate-pulse flex flex-col items-center justify-center border border-gray-700">
                    <div className="w-10 h-10 border-4 border-accent-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                    <span className="text-xs text-gray-400 font-medium animate-pulse">{msg.content}</span>
                 </div>
             </div>
          ) : msg.isLoading ? (
             <div className="flex items-center gap-3 min-w-[150px]">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span className="text-sm font-medium text-gray-300 animate-pulse">{msg.content}</span>
             </div>
          ) : (
            <div className="text-sm md:text-base leading-relaxed break-words whitespace-pre-wrap text-gray-100 min-h-[24px]">
                {renderContent(msg.content)}
            </div>
          )}
          
          {/* Audio Button for AI */}
          {!isUser && msg.content !== '...' && !msg.isLoading && !isMediaLoading && (
              <button 
                onClick={handlePlayVoice} 
                disabled={audioStatus !== 'idle'}
                className={`mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded-full transition-colors 
                    ${audioStatus === 'playing' ? 'bg-accent-500 text-white animate-pulse' : 
                      audioStatus === 'generating' ? 'bg-gray-700 text-gray-400 cursor-wait' :
                      'bg-gray-700/50 text-gray-400 hover:bg-gray-600 hover:text-white'}`}
              >
                  {audioStatus === 'generating' ? (
                      <>
                          <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                          <span>Генерация звука...</span>
                      </>
                  ) : audioStatus === 'playing' ? (
                      <>
                          <SpeakerIcon />
                          <span>Воспроизведение...</span>
                      </>
                  ) : (
                      <>
                          <SpeakerIcon />
                          <span>Озвучить</span>
                      </>
                  )}
              </button>
          )}

          {/* Generated Image Container */}
          {msg.imageUrl && (
            <div className="mt-3 rounded-lg overflow-hidden border border-gray-700 relative group animate-fade-in">
              <img src={msg.imageUrl} alt="Generated content" className="w-full h-auto max-h-80 object-cover" />
              <div className="absolute top-2 right-2 flex gap-2 transition-opacity">
                  <button 
                    onClick={() => onSaveToGallery(msg.imageUrl!, 'image', `Из чата: ${msg.content.slice(0, 30)}...`)}
                    className="p-2 bg-gray-900/80 rounded-full text-white hover:bg-accent-500 transition-colors shadow-lg"
                    title="Сохранить в галерею"
                  >
                      <SaveIcon />
                  </button>
              </div>
            </div>
          )}
          
          {/* Generated Video Container */}
          {msg.videoUrl && (
             <div className="mt-3 rounded-lg overflow-hidden border border-gray-700 relative group animate-fade-in">
                <video src={msg.videoUrl} controls className="w-full h-auto max-h-80" />
                <div className="absolute top-2 right-2 flex gap-2 transition-opacity z-10">
                   <button 
                      onClick={() => onSaveToGallery(msg.videoUrl!, 'video', `Видео: ${msg.content.slice(0, 30)}...`)}
                      className="p-2 bg-gray-900/80 rounded-full text-white hover:bg-accent-500 transition-colors shadow-lg"
                      title="Сохранить в галерею"
                    >
                        <SaveIcon />
                    </button>
                </div>
             </div>
          )}
          
          <div className="text-[10px] text-gray-500 mt-2 text-right">
            {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Missing Components Implementation ---

const CreateCharacter: React.FC<{ 
    onSave: (c: Character) => void; 
    onCancel: () => void; 
    initialData?: Character 
}> = ({ onSave, onCancel, initialData }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [bio, setBio] = useState(initialData?.bio || '');
    const [avatarPrompt, setAvatarPrompt] = useState('');
    const [avatar, setAvatar] = useState(initialData?.avatar || '');
    const [height, setHeight] = useState<number>(initialData?.height || 1700);
    const [voice, setVoice] = useState(initialData?.voice || 'Kore');
    const [voiceSpeed, setVoiceSpeed] = useState(initialData?.voiceSpeed || 1.0);
    const [voicePitch, setVoicePitch] = useState(initialData?.voicePitch || 0);
    const [color, setColor] = useState(initialData?.color || '#8B5CF6'); 
    const [isGenerating, setIsGenerating] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const compressed = await compressImage(base64, 400); 
                setAvatar(compressed);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleGenerateAvatar = async () => {
      if (!avatarPrompt && !description) return;
      setIsGenerating(true);
      try {
        const prompt = avatarPrompt || `Portrait of ${name}, ${description}`;
        const url = await generateImage(prompt);
        const compressed = await compressImage(url, 400);
        setAvatar(compressed);
      } catch (e) {
        console.error(e);
        alert("Failed to generate avatar");
      } finally {
        setIsGenerating(false);
      }
    };
  
    const handleSave = () => {
      if (!name || !description || !avatar) return;
      const newChar: Character = {
        id: initialData?.id || generateId(),
        name,
        description,
        bio,
        avatar,
        height,
        voice,
        voiceSpeed,
        voicePitch,
        color,
        created_at: initialData?.created_at || Date.now(),
        evolutionContext: initialData?.evolutionContext
      };
      onSave(newChar);
    };
  
    return (
      <div className="max-w-2xl mx-auto p-6 bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl">
        <h2 className="text-2xl font-bold mb-6 text-white">{initialData ? 'Редактировать персонажа' : 'Создание персонажа'}</h2>
        
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex gap-6 items-start">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
            />
            <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-32 h-32 rounded-xl bg-gray-800 border-2 border-dashed border-gray-700 flex items-center justify-center overflow-hidden shrink-0 relative group cursor-pointer hover:border-gray-500 transition-colors"
                title="Нажмите, чтобы загрузить изображение"
            >
              {avatar ? (
                <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-600">
                    <CameraIcon className="w-8 h-8" />
                    <span className="text-[10px] font-bold uppercase">Загрузить</span>
                </div>
              )}
              {isGenerating && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                      <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  </div>
              )}
              {!isGenerating && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                      <span className="text-white text-xs font-bold">Загрузить</span>
                  </div>
              )}
            </div>
            <div className="flex-1 space-y-3">
               <label className="block text-sm font-medium text-gray-400">Аватар (Загрузите или сгенерируйте)</label>
               <div className="flex gap-2">
                 <input 
                    value={avatarPrompt}
                    onChange={e => setAvatarPrompt(e.target.value)}
                    placeholder="Промпт для генерации..." 
                    className="flex-1 bg-gray-800 border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
                 />
                 <Button onClick={handleGenerateAvatar} disabled={isGenerating} variant="secondary">
                   {isGenerating ? '...' : 'Генерировать'}
                 </Button>
               </div>
               <p className="text-xs text-gray-500">Оставьте пустым, чтобы использовать описание персонажа.</p>
            </div>
          </div>
  
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Имя</label>
                <input 
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
                  placeholder="Имя персонажа"
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Цвет имени</label>
                <input 
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="w-full h-[42px] bg-gray-800 border-gray-700 rounded-lg cursor-pointer px-1 py-1"
                />
             </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                 <ScaleIcon /> Рост (мм)
             </label>
             <div className="flex items-center gap-4 bg-gray-800/50 p-3 rounded-xl border border-gray-700">
                 <input 
                    type="range"
                    min="500"
                    max="2500"
                    step="10"
                    value={height}
                    onChange={e => setHeight(parseInt(e.target.value))}
                    className="flex-1 accent-accent-500 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                 />
                 <div className="flex items-center gap-2 bg-gray-900 rounded-lg px-3 py-1 border border-gray-700">
                     <input 
                        type="number"
                        value={height}
                        onChange={e => setHeight(parseInt(e.target.value))}
                        className="w-16 bg-transparent text-white text-right outline-none font-mono"
                     />
                     <span className="text-gray-500 text-sm font-bold">mm</span>
                 </div>
             </div>
          </div>
  
          <div className="grid grid-cols-1 gap-4">
            <div>
               <label className="block text-sm font-medium text-gray-400 mb-1">Личность (Системный промпт)</label>
               <textarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full h-24 bg-gray-800 border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent-500 outline-none resize-none"
                  placeholder="Опиши характер, манеру речи..."
               />
            </div>
            <div>
               <label className="block text-sm font-medium text-gray-400 mb-1">Биография (История)</label>
               <textarea 
                  value={bio}
                  onChange={e => setBio(e.target.value)}
                  className="w-full h-32 bg-gray-800 border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent-500 outline-none resize-none"
                  placeholder="Подробная история жизни, важные события, тайны..."
               />
            </div>
          </div>
  
          <div className="bg-gray-800/50 p-4 rounded-xl border border-gray-800 space-y-4">
             <h3 className="text-sm font-bold text-gray-300 flex items-center gap-2"><SpeakerIcon /> Настройки Голоса (TTS)</h3>
             
             <div>
                 <label className="block text-xs font-medium text-gray-400 mb-1">Голос</label>
                 <select 
                   value={voice}
                   onChange={e => setVoice(e.target.value)}
                   className="w-full bg-gray-800 border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-accent-500 outline-none"
                 >
                   {['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].map(v => (
                     <option key={v} value={v}>{v}</option>
                   ))}
                 </select>
             </div>

             <div className="grid grid-cols-2 gap-4">
                 <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Скорость: {voiceSpeed}x</label>
                    <input 
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={voiceSpeed}
                        onChange={e => setVoiceSpeed(parseFloat(e.target.value))}
                        className="w-full accent-accent-500"
                    />
                 </div>
                 <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1">Тон (Pitch): {voicePitch}</label>
                    <input 
                        type="range"
                        min="-1200"
                        max="1200"
                        step="100"
                        value={voicePitch}
                        onChange={e => setVoicePitch(parseInt(e.target.value))}
                        className="w-full accent-accent-500"
                    />
                    <div className="flex justify-between text-[10px] text-gray-600 px-1">
                        <span>Low</span>
                        <span>High</span>
                    </div>
                 </div>
             </div>
          </div>
  
          <div className="flex gap-4 pt-4 border-t border-gray-800">
             <Button onClick={onCancel} variant="ghost" className="flex-1">Отмена</Button>
             <Button onClick={handleSave} disabled={!name || !description || !avatar} className="flex-1">
                 {initialData ? 'Сохранить изменения' : 'Создать'}
             </Button>
          </div>
        </div>
      </div>
    );
};
  
const GalleryPage: React.FC<{ items: GalleryItem[]; onDelete: (id: string) => void; onBack: () => void }> = ({ items, onDelete, onBack }) => {
    
    const handleDownload = (item: GalleryItem) => {
        const link = document.createElement('a');
        link.href = item.url;
        link.download = `soulkyn_${item.type}_${Date.now()}.${item.type === 'video' ? 'mp4' : 'png'}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="max-w-6xl mx-auto p-6 animate-fade-in min-h-screen">
            <header className="flex items-center gap-4 mb-8">
                <button onClick={onBack} className="p-2 hover:bg-gray-800 rounded-full transition-colors"><ArrowLeftIcon /></button>
                <h1 className="text-3xl font-bold">Галерея</h1>
            </header>
            
            {items.length === 0 ? (
                <div className="text-center text-gray-500 mt-20">
                    <GalleryIcon className="w-16 h-16 mx-auto mb-4 opacity-20" />
                    <p>Галерея пуста. Сохраняйте изображения из чатов.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {items.map(item => (
                        <div key={item.id} className="bg-gray-900 rounded-xl overflow-hidden group border border-gray-800 hover:border-accent-500/50 transition-all">
                            <div className="aspect-square relative bg-gray-800">
                                {item.type === 'video' ? (
                                    <video src={item.url} controls className="w-full h-full object-cover" />
                                ) : (
                                    <img src={item.url} alt={item.caption} className="w-full h-full object-cover" />
                                )}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                    <button 
                                        onClick={() => handleDownload(item)}
                                        className="bg-gray-900/80 text-white p-1.5 rounded-full hover:bg-accent-500 backdrop-blur"
                                        title="Скачать"
                                    >
                                        <DownloadIcon />
                                    </button>
                                    <button 
                                        onClick={() => onDelete(item.id)}
                                        className="bg-red-500/80 text-white p-1.5 rounded-full hover:bg-red-600 backdrop-blur"
                                        title="Удалить"
                                    >
                                        <TrashIcon />
                                    </button>
                                </div>
                                <div className="absolute top-2 left-2">
                                     {item.type === 'video' ? (
                                         <span className="bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-white">
                                             <VideoIcon width={12} height={12}/> Video
                                         </span>
                                     ) : item.type === 'background' ? (
                                          <span className="bg-black/50 backdrop-blur px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 text-white">
                                              <ImageIcon width={12} height={12}/> BG
                                          </span>
                                     ) : null}
                                </div>
                            </div>
                            <div className="p-3">
                                <p className="text-sm text-gray-300 line-clamp-2" title={item.caption}>{item.caption || 'Без описания'}</p>
                                <span className="text-xs text-gray-600 mt-2 block">{new Date(item.timestamp).toLocaleDateString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// --- Chat Interface ---

const ChatInterface = ({ 
    session, 
    characters, 
    onUpdateSession, 
    onUpdateCharacter, 
    onBack, 
    onOpenDirectChat, 
    onSaveToGallery, 
    setGlobalError, 
    sendMessageToAI,
    onGenerateMedia,
    onDeleteSession
  }: { 
    session: ChatSession, 
    characters: Character[], 
    onUpdateSession: (s: ChatSession) => void,
    onUpdateCharacter: (c: Character) => void,
    onBack: () => void,
    onOpenDirectChat: (id: string) => void,
    onSaveToGallery: (url: string, type: 'image' | 'video' | 'background', caption: string) => void,
    setGlobalError: (msg: string | null) => void,
    sendMessageToAI: (text: string, image?: string) => void,
    onGenerateMedia: (type: 'photo' | 'video') => void,
    onDeleteSession: () => void
  }) => {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [attachment, setAttachment] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const sessionRef = useRef(session);
    const recognitionRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
  
    useEffect(() => { sessionRef.current = session; }, [session]);
  
    const sessionCharacters = characters.filter(c => session.participants.includes(c.id));
  
    const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };
    useEffect(() => { scrollToBottom(); }, [session.messages]);
  
    const handleDeleteChat = () => {
        onDeleteSession();
    };
  
    const toggleNSFW = () => { onUpdateSession({ ...session, isNSFW: !session.isNSFW }); };
  
    const toggleVoiceInput = async () => {
      if (isRecording) {
          recognitionRef.current?.stop();
          setIsRecording(false);
          return;
      }
      try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
      } catch (err: any) {
          console.error("Mic error:", err);
          alert("Ошибка микрофона.");
          return;
      }
  
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) return alert("Браузер не поддерживает голосовой ввод");
  
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.continuous = true;
      recognition.interimResults = true;
  
      recognition.onstart = () => setIsRecording(true);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = (e: any) => { setIsRecording(false); setGlobalError(e.error === 'network' ? "Ошибка сети" : "Ошибка микрофона"); };
      
      recognition.onresult = (event: any) => {
          let final = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) final += event.results[i][0].transcript;
          }
          if (final) setInput(p => p + (p && !p.endsWith(' ') ? ' ' : '') + final);
      };
      recognitionRef.current = recognition;
      recognition.start();
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const compressed = await compressImage(base64, 800);
                setAttachment(compressed);
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const clearAttachment = () => setAttachment(null);
  
    const handleSend = () => {
        if (!input.trim() && !attachment) return;
        sendMessageToAI(input, attachment || undefined);
        setInput('');
        setAttachment(null);
    };
  
    const handleProfitAsk = () => { sendMessageToAI("Tell me about profit! 💰"); };
  
    return (
      <div className="flex flex-col h-full relative">
        <div className="absolute inset-0 z-0 pointer-events-none">
          {session.backgroundUrl && <img src={session.backgroundUrl} className="w-full h-full object-cover opacity-50" alt="Background" />}
        </div>
  
        <div className="relative z-20 h-16 border-b border-gray-800 bg-gray-900/80 backdrop-blur flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="text-gray-400 hover:text-white p-2"><ArrowLeftIcon /></button>
            <div>
              <h3 className="font-bold text-lg text-white shadow-black drop-shadow-md">{session.name}</h3>
              <div className="flex -space-x-2 overflow-hidden mt-1.5">
                {sessionCharacters.map(c => <img key={c.id} className="inline-block h-5 w-5 rounded-full ring-2 ring-gray-900" src={c.avatar} alt={c.name} />)}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
               {session.backgroundUrl && (
                   <Button variant="ghost" className="!p-2 text-gray-400 hover:text-accent-500" onClick={() => onSaveToGallery(session.backgroundUrl!, 'background', `Фон ${session.name}`)}>
                       <SaveIcon />
                   </Button>
               )}
               <button onClick={toggleNSFW} className={`text-xs font-bold border rounded px-2 py-1 ${session.isNSFW ? 'border-red-500 text-red-500' : 'border-gray-600 text-gray-500'}`}>
                  {session.isNSFW ? 'NSFW' : 'SFW'}
               </button>
              <Button variant="ghost" className="!p-2 text-gray-400 hover:text-white" onClick={() => onOpenDirectChat(session.participants[0])}><ChatIcon /></Button>
              <Button variant="ghost" className="!p-2 text-red-400 hover:text-red-300" onClick={handleDeleteChat} title="Удалить чат"><TrashIcon /></Button>
          </div>
        </div>
  
        <div className="relative z-20 flex-1 overflow-y-auto p-4 md:p-6">
          <div className="max-w-4xl mx-auto w-full space-y-4">
              {session.messages.length === 0 && <div className="text-center text-gray-500 opacity-60 mt-10">Чат начался.</div>}
              {session.messages.map(msg => <MessageBubble key={msg.id} msg={msg} characters={characters} onSaveToGallery={onSaveToGallery} />)}
              <div ref={messagesEndRef} />
          </div>
        </div>
  
        <div className="relative z-20 p-4 bg-gray-900/90 border-t border-gray-800 shrink-0">
          {/* Attachment Preview */}
          {attachment && (
              <div className="max-w-4xl mx-auto mb-2 flex items-start">
                  <div className="relative group">
                      <img src={attachment} alt="Preview" className="h-20 w-auto rounded-lg border border-gray-600 object-cover" />
                      <button 
                        onClick={clearAttachment}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                      >
                          <CloseIcon />
                      </button>
                  </div>
              </div>
          )}

          <div className="flex gap-2 max-w-4xl mx-auto items-end">
            <div className="flex gap-1 pb-1">
               <input 
                   type="file" 
                   ref={fileInputRef} 
                   onChange={handleFileSelect} 
                   accept="image/*" 
                   className="hidden" 
               />
               <Button variant="ghost" className="!p-2 text-gray-400 hover:text-accent-500" onClick={() => fileInputRef.current?.click()} title="Прикрепить фото">
                   <PaperclipIcon />
               </Button>
               <Button variant="ghost" className="!p-2 text-gray-400 hover:text-accent-500" onClick={() => onGenerateMedia('photo')} title="Фото">
                   <CameraIcon />
               </Button>
               <Button variant="ghost" className="!p-2 text-gray-400 hover:text-accent-500" onClick={() => onGenerateMedia('video')} title="Видео">
                   <VideoIcon />
               </Button>
               <Button variant="ghost" className="!p-2 text-gray-400 hover:text-accent-500" onClick={handleProfitAsk} title="Profit">
                   <CoinIcon />
               </Button>
            </div>
            <div className="flex-1 relative">
              <input
                  className="w-full bg-gray-800 border-gray-700 text-white rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-accent-500/50"
                  placeholder="Напишите сообщение..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !isProcessing && handleSend()}
                  disabled={isProcessing}
              />
              <button onClick={toggleVoiceInput} className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400'}`}>
                  {isRecording ? <StopIcon /> : <MicIcon />}
              </button>
            </div>
            <Button onClick={handleSend} disabled={!input.trim() && !attachment} className="rounded-xl px-6 h-[50px]">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </Button>
          </div>
        </div>
      </div>
    );
  };

const App = () => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(Page.HOME);
  const [selectedChars, setSelectedChars] = useState<string[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const loadData = async () => {
      try {
        // Sequentially load to prevent IDB race conditions during mounting
        const loadedChars = await storage.get<Character[]>('ai_rpg_chars');
        const loadedChats = await storage.get<ChatSession[]>('ai_rpg_chats');
        const loadedGallery = await storage.get<GalleryItem[]>('ai_rpg_gallery');

        if (loadedChars) setCharacters(loadedChars);
        if (loadedChats) setChats(loadedChats);
        if (loadedGallery) setGallery(loadedGallery);
        
      } catch (e) {
        console.error("Critical storage error:", e);
        setGlobalError("Failed to load data. Your browser storage might be full or restricted.");
      } finally {
        setIsDataLoaded(true); 
      }
    };
    loadData();
  }, []);

  const triggerSave = async (key: string, data: any) => {
      setSaveStatus('saving');
      try {
          await storage.set(key, data);
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
          console.error("Save error:", e);
          // Don't show global error for background saves to avoid annoyance, rely on IDB console logs
      }
  };
  
  const handleToggleSelect = (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (selectedChars.includes(id)) {
          setSelectedChars(prev => prev.filter(c => c !== id));
      } else {
          setSelectedChars(prev => [...prev, id]);
      }
  };

  const handleStartGroupChat = async () => {
      if (selectedChars.length === 0) return;
      const participants = characters.filter(c => selectedChars.includes(c.id));
      const newChat: ChatSession = {
          id: generateId(),
          name: participants.map(p => p.name).join(', '),
          participants: participants.map(p => p.id),
          messages: [],
          lastUpdated: Date.now()
      };
      
      const updatedChats = [newChat, ...chats];
      setChats(updatedChats);
      setActiveChatId(newChat.id);
      setSelectedChars([]);
      setPage(Page.CHAT);
      
      await triggerSave('ai_rpg_chats', updatedChats);
  };

  const handleStartDirectChat = async (charId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const existing = chats.find(c => c.participants.length === 1 && c.participants[0] === charId);
    if (existing) {
      setActiveChatId(existing.id);
      setPage(Page.CHAT);
      return;
    }
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const newChat: ChatSession = {
      id: generateId(),
      name: char.name,
      participants: [charId],
      messages: [],
      lastUpdated: Date.now()
    };
    
    const newChats = [newChat, ...chats];
    setChats(newChats);
    setActiveChatId(newChat.id);
    setPage(Page.CHAT);
    
    await triggerSave('ai_rpg_chats', newChats);
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (window.confirm("Удалить чат?")) {
          const newChats = chats.filter(c => c.id !== id);
          setChats(newChats);
          if (activeChatId === id) {
              setActiveChatId(null);
              setPage(Page.HOME);
          }
          await triggerSave('ai_rpg_chats', newChats);
      }
  };

  const handleDeleteCharacter = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Вы уверены, что хотите удалить этого персонажа? Все его данные будут утеряны.")) {
        const newChars = characters.filter(c => c.id !== id);
        setCharacters(newChars);
        setSelectedChars(prev => prev.filter(c => c !== id));
        // Also verify if we should clean up chats, currently we keep history but char data will be missing in new renders
        // It's safer to keep chats history for now.
        await triggerSave('ai_rpg_chars', newChars);
    }
  };

  const handleEditCharacter = (e: React.MouseEvent, char: Character) => {
      e.stopPropagation();
      setEditingCharacter(char);
      setPage(Page.CREATE);
  };

  const handleSaveCharacter = async (c: Character) => {
      // Check if updating existing or creating new
      let newChars;
      if (characters.some(char => char.id === c.id)) {
          newChars = characters.map(char => char.id === c.id ? c : char);
      } else {
          newChars = [c, ...characters];
      }
      
      setCharacters(newChars);
      setEditingCharacter(null); // Reset editing state
      setPage(Page.HOME);
      await triggerSave('ai_rpg_chars', newChars);
  };

  const handleUpdateSession = async (updatedSession: ChatSession) => {
      const newChats = chats.map(c => c.id === updatedSession.id ? updatedSession : c);
      setChats(newChats);
      await triggerSave('ai_rpg_chats', newChats);
  }
  
  const handleUpdateCharacter = async (updatedChar: Character) => {
      const newChars = characters.map(char => char.id === updatedChar.id ? updatedChar : char);
      setCharacters(newChars);
      await triggerSave('ai_rpg_chars', newChars);
  }
  
  const handleAddToGallery = async (url: string, type: 'image' | 'video' | 'background', caption: string) => {
      const newItem: GalleryItem = {
          id: generateId(),
          type,
          url,
          caption,
          timestamp: Date.now()
      };
      
      // If it's a data URL, try to compress it if it's an image
      if (type === 'image' || type === 'background') {
          if (newItem.url.startsWith('data:image')) {
              newItem.url = await compressImage(newItem.url, 800); // 800px max for gallery
          }
      }

      const newGallery = [newItem, ...gallery];
      setGallery(newGallery);
      try {
          await triggerSave('ai_rpg_gallery', newGallery);
          alert("Сохранено в галерею!");
      } catch (e) {
          console.error("Failed to save to gallery", e);
          alert("Ошибка сохранения!");
      }
  };

  const handleDeleteFromGallery = async (id: string) => {
      if (window.confirm("Удалить из галереи?")) {
          const newGallery = gallery.filter(item => item.id !== id);
          setGallery(newGallery);
          await triggerSave('ai_rpg_gallery', newGallery);
      }
  };

  const handleGenerateMedia = async (type: 'photo' | 'video') => {
      if (!activeChatId) return;
      const chatIndex = chats.findIndex(c => c.id === activeChatId);
      if (chatIndex === -1) return;
      
      const session = chats[chatIndex];
      const activeChar = characters.find(c => session.participants[0] === c.id) || { id: 'sys', name: 'System' };
      
      const tempId = generateId();
      const placeholder: Message = {
          id: tempId,
          senderId: activeChar.id,
          senderName: activeChar.name,
          content: "⏳ Анализирую контекст...",
          timestamp: Date.now(),
          isLoading: true
      };

      const newChats = [...chats];
      newChats[chatIndex] = { ...session, messages: [...session.messages, placeholder] };
      setChats(newChats);

      const updateLoadingMessage = (text: string) => {
          setChats(prev => {
              const uChats = [...prev];
              const idx = uChats.findIndex(c => c.id === activeChatId);
              if (idx === -1) return prev;
              const uChat = { ...uChats[idx] };
              uChat.messages = uChat.messages.map(m => m.id === tempId ? { ...m, content: text } : m);
              uChats[idx] = uChat;
              return uChats;
          });
      };

      try {
          const activeCharacters = characters.filter(c => session.participants.includes(c.id));
          // Pass formatted character descriptions including height
          const charDescriptions = activeCharacters.map(c => 
              `Имя: ${c.name}, Рост: ${c.height || 1700}мм, Внешность: ${c.description}`
          );

          const plot = await getPlotSummary(
              session.messages.map(m => ({ sender: m.senderName, text: m.content })),
              charDescriptions
          );
          
          updateLoadingMessage(type === 'photo' ? "🎨 Рисую сцену (Генерирую)..." : "🎬 Монтирую видео (Генерирую)...");
          
          let mediaUrl = "";
          if (type === 'photo') {
              mediaUrl = await generateImage(plot, activeCharacters.map(c => c.avatar));
          } else {
              mediaUrl = await generateVideo(plot);
          }

          if (mediaUrl) {
               // Compress if image
               if (type === 'photo' && mediaUrl.startsWith('data:image')) {
                   mediaUrl = await compressImage(mediaUrl, 800);
               }

               const successMsg: Message = {
                   id: tempId,
                   senderId: activeChar.id,
                   senderName: activeChar.name,
                   content: type === 'photo' ? "Фото с места событий:" : "Видеофрагмент:",
                   imageUrl: type === 'photo' ? mediaUrl : undefined,
                   videoUrl: type === 'video' ? mediaUrl : undefined,
                   timestamp: Date.now(),
                   isLoading: false
               };
               setChats(prev => {
                   const uChats = [...prev];
                   const idx = uChats.findIndex(c => c.id === activeChatId);
                   if (idx !== -1) {
                        const uChat = { ...uChats[idx] };
                        uChat.messages = uChat.messages.map(m => m.id === tempId ? successMsg : m);
                        uChats[idx] = uChat;
                        triggerSave('ai_rpg_chats', uChats);
                        return uChats;
                   }
                   return prev;
               });
          } else {
               throw new Error("Empty media URL");
          }
      } catch (e) {
          console.error(e);
          setGlobalError("Ошибка генерации медиа");
           setChats(prev => {
                const uChats = [...prev];
                const idx = uChats.findIndex(c => c.id === activeChatId);
                if (idx !== -1) {
                    const uChat = { ...uChats[idx] };
                    uChat.messages = uChat.messages.filter(m => m.id !== tempId);
                    uChats[idx] = uChat;
                    return uChats;
                }
                return prev;
           });
      }
  };

  const sendMessage = async (text: string, image?: string) => {
    if (!activeChatId) return;
    const chatIndex = chats.findIndex(c => c.id === activeChatId);
    if (chatIndex === -1) return;
    
    // 1. Add User Message
    const userMsg: Message = {
        id: generateId(),
        senderId: 'user',
        senderName: 'Вы',
        content: text,
        imageUrl: image, // Store user image
        timestamp: Date.now()
    };
    
    const newChats = [...chats];
    let currentChat = { ...newChats[chatIndex] };
    currentChat.messages = [...currentChat.messages, userMsg];
    currentChat.lastUpdated = Date.now();
    newChats[chatIndex] = currentChat;
    
    setChats([...newChats]);
    triggerSave('ai_rpg_chats', newChats);

    // 2. AI Logic
    const participants = characters.filter(c => currentChat.participants.includes(c.id));
    let contextMessages = [...currentChat.messages];

    for (const char of participants) {
        const placeholderId = generateId();
        const placeholderMsg: Message = {
            id: placeholderId,
            senderId: char.id,
            senderName: char.name,
            content: '...',
            timestamp: Date.now()
        };

        const chatForUpdate = { ...newChats[chatIndex] };
        chatForUpdate.messages = [...chatForUpdate.messages, placeholderMsg];
        newChats[chatIndex] = chatForUpdate;
        setChats([...newChats]);

        try {
             const otherCharNames = participants.filter(p => p.id !== char.id).map(p => p.name);
             
             // Inject height into bio for context
             const fullBio = `Рост: ${char.height || 1700}мм. ${char.bio || ''}`;

             const fullResponseText = await streamCharacterResponse(
                char.name,
                char.description,
                fullBio,
                char.evolutionContext,
                contextMessages.map(m => ({ sender: m.senderId === 'user' ? 'user' : m.senderName, text: m.content })),
                otherCharNames,
                currentChat.isNSFW || false,
                image, // Pass the image to the model context
                (chunk) => {
                    setChats(prevChats => {
                        const newC = [...prevChats];
                        const cIdx = newC.findIndex(c => c.id === activeChatId);
                        if (cIdx === -1) return prevChats;
                        const chat = { ...newC[cIdx] };
                        const msgs = [...chat.messages];
                        const mIdx = msgs.findIndex(m => m.id === placeholderId);
                        if (mIdx !== -1) {
                            msgs[mIdx] = { ...msgs[mIdx], content: chunk };
                            chat.messages = msgs;
                            newC[cIdx] = chat;
                            return newC;
                        }
                        return prevChats;
                    });
                }
             );
             
             // Post-processing
             const chatRef = newChats[chatIndex];
             const msgIndex = chatRef.messages.findIndex(m => m.id === placeholderId);
             
             if (fullResponseText.includes('[SILENCE]') || !fullResponseText) {
                 chatRef.messages = chatRef.messages.filter(m => m.id !== placeholderId);
             } else {
                 let finalText = fullResponseText;
                 let finalImageUrl;
                 const imgMatch = finalText.match(/\[GEN_IMG:\s*(.*?)\]/);
                 if (imgMatch) {
                     const prompt = imgMatch[1];
                     finalText = finalText.replace(imgMatch[0], '').trim();
                     finalImageUrl = await generateImage(prompt, [char.avatar]);
                     if (finalImageUrl.startsWith('data:image')) {
                        finalImageUrl = await compressImage(finalImageUrl, 800);
                     }
                 }
                 
                 if (msgIndex !== -1) {
                    chatRef.messages[msgIndex].content = finalText;
                    if (finalImageUrl) chatRef.messages[msgIndex].imageUrl = finalImageUrl;
                    contextMessages.push(chatRef.messages[msgIndex]);
                 }
             }

             newChats[chatIndex] = { ...chatRef };
             setChats([...newChats]);
             triggerSave('ai_rpg_chats', newChats);
             
             // Evolution
             const newEvolution = await analyzeCharacterEvolution(
                 char.name,
                 char.description,
                 char.evolutionContext,
                 contextMessages.slice(-10).map(m => ({ sender: m.senderName, text: m.content }))
             );
             if (newEvolution !== char.evolutionContext) {
                 handleUpdateCharacter({ ...char, evolutionContext: newEvolution });
             }

        } catch (e) {
            console.error(e);
            const chatRef = newChats[chatIndex];
            chatRef.messages = chatRef.messages.filter(m => m.id !== placeholderId);
            newChats[chatIndex] = { ...chatRef };
            setChats([...newChats]);
        }
    }
  };

  if (!isDataLoaded && !globalError) {
      return (
          <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
              <div className="flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-accent-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-400 font-mono animate-pulse">Загрузка...</p>
              </div>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        {globalError && (
             <div className="bg-red-900/90 text-white p-3 text-center fixed top-0 w-full z-50 backdrop-blur border-b border-red-700 animate-fade-in flex justify-between items-center px-6">
                 <span>⚠️ {globalError}</span>
                 <button onClick={() => setGlobalError(null)} className="text-red-200 hover:text-white">✕</button>
             </div>
        )}
        {saveStatus === 'saved' && (
             <div className="fixed top-4 right-4 z-50 bg-green-900/80 text-green-100 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-fade-in backdrop-blur border border-green-700">
                 <CheckIcon /> Saved
             </div>
        )}

      {page === Page.HOME && (
          <div className="max-w-6xl mx-auto p-6 animate-fade-in pb-24 h-screen overflow-y-auto custom-scrollbar">
              <header className="flex flex-col md:flex-row justify-between items-center mb-10 gap-4 mt-6">
                  <div>
                      <h1 className="text-4xl font-black text-white mb-2 flex items-baseline select-none">
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-500 to-purple-500">S</span>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-500 to-purple-500">x</span>
                          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent-500 to-purple-500 ml-2">AI</span>
                      </h1>
                  </div>
                  <div className="flex gap-3">
                    <Button onClick={() => setPage(Page.GALLERY)} variant="secondary"><GalleryIcon /> Галерея</Button>
                    <Button onClick={() => { setEditingCharacter(null); setPage(Page.CREATE); }}><PlusIcon /> Создать Персонажа</Button>
                  </div>
              </header>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-8 space-y-6">
                      <div className="flex justify-between items-center">
                          <h2 className="text-2xl font-bold flex items-center gap-2"><UsersIcon /> Ваши Персонажи</h2>
                          {selectedChars.length > 0 && <span className="text-accent-500 text-sm font-bold">Выбрано: {selectedChars.length}</span>}
                      </div>

                      {characters.length === 0 ? (
                          <div className="bg-gray-900/50 border-2 border-dashed border-gray-800 rounded-xl p-12 text-center">
                              <p className="text-gray-500 mb-4">Список персонажей пуст</p>
                              <Button variant="secondary" onClick={() => { setEditingCharacter(null); setPage(Page.CREATE); }}>Создать первого</Button>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-20">
                              {characters.map(char => {
                                  const isSelected = selectedChars.includes(char.id);
                                  return (
                                  <div key={char.id} onClick={() => handleToggleSelect(char.id)} className={`relative bg-gray-900 border rounded-xl p-4 flex gap-4 transition-all group cursor-pointer ${isSelected ? 'border-accent-500 bg-accent-900/10' : 'border-gray-800 hover:border-gray-600'}`}>
                                      <div className={`absolute top-3 right-3 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-accent-500 border-accent-500' : 'border-gray-600 bg-gray-900 group-hover:border-gray-400'}`}>
                                          {isSelected && <CheckIcon />}
                                      </div>
                                      <img src={char.avatar} alt={char.name} className="w-20 h-20 rounded-lg object-cover bg-gray-800 shrink-0" />
                                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                                          <div>
                                              <h3 className="font-bold text-lg truncate pr-8" style={{color: char.color}}>{char.name}</h3>
                                              <p className="text-sm text-gray-400 line-clamp-2 leading-snug">{char.description}</p>
                                          </div>
                                          <div className="flex gap-2 self-start mt-2 z-10">
                                            <button onClick={(e) => handleStartDirectChat(char.id, e)} className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-wide px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors" title="Написать">
                                                <ChatIcon />
                                            </button>
                                            <button onClick={(e) => handleEditCharacter(e, char)} className="text-gray-500 hover:text-blue-400 p-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors" title="Редактировать">
                                                <EditIcon />
                                            </button>
                                            <button onClick={(e) => handleDeleteCharacter(e, char.id)} className="text-gray-500 hover:text-red-500 p-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors" title="Удалить">
                                                <TrashIcon />
                                            </button>
                                          </div>
                                      </div>
                                  </div>
                              )})}
                          </div>
                      )}
                  </div>

                  <div className="lg:col-span-4 space-y-6">
                      <h2 className="text-2xl font-bold flex items-center gap-2"><ChatIcon /> Чаты</h2>
                      <div className="space-y-3">
                          {chats.length === 0 && <p className="text-gray-500 italic">Нет активных чатов</p>}
                          {[...chats].sort((a, b) => b.lastUpdated - a.lastUpdated).map(chat => (
                              <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setPage(Page.CHAT); }} className="bg-gray-900 hover:bg-gray-800 p-3 rounded-xl cursor-pointer flex items-center gap-3 group relative transition-colors">
                                  <div className="w-12 h-12 rounded-full bg-gray-800 overflow-hidden shrink-0 grid place-items-center">
                                      {chat.participants.length > 1 ? (
                                           <div className="grid grid-cols-2 w-full h-full gap-0.5">
                                               {chat.participants.slice(0, 4).map(pid => {
                                                   const p = characters.find(c => c.id === pid);
                                                   return p ? <img key={pid} src={p.avatar} className="w-full h-full object-cover" /> : null;
                                               })}
                                           </div>
                                      ) : (
                                          (() => {
                                              const p = characters.find(c => c.id === chat.participants[0]);
                                              return p ? <img src={p.avatar} className="w-full h-full object-cover" /> : <UsersIcon className="p-2 text-gray-500" />;
                                          })()
                                      )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <h4 className="font-bold text-gray-200 truncate">{chat.name}</h4>
                                      <p className="text-xs text-gray-500 truncate">
                                          {chat.messages.length > 0 ? chat.messages[chat.messages.length-1].content : 'Пусто'}
                                      </p>
                                      <p className="text-[10px] text-gray-600">
                                          {new Date(chat.lastUpdated).toLocaleDateString()} {new Date(chat.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                      </p>
                                  </div>
                                  <button onClick={(e) => deleteChat(e, chat.id)} className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity relative z-10"><TrashIcon /></button>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
              <div className={`fixed bottom-8 left-1/2 transform -translate-x-1/2 transition-all duration-300 ${selectedChars.length > 0 ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'}`}>
                  <Button onClick={handleStartGroupChat} className="shadow-2xl rounded-full px-8 py-4 text-lg animate-bounce-subtle">Создать групповой чат ({selectedChars.length})</Button>
              </div>
          </div>
      )}

      {page === Page.CREATE && (
          <div className="pt-10 pb-10 h-screen overflow-y-auto custom-scrollbar">
              <CreateCharacter 
                key={editingCharacter ? editingCharacter.id : 'new'} 
                onSave={handleSaveCharacter} 
                onCancel={() => { setEditingCharacter(null); setPage(Page.HOME); }} 
                initialData={editingCharacter || undefined}
              />
          </div>
      )}

      {page === Page.GALLERY && (
          <GalleryPage items={gallery} onDelete={handleDeleteFromGallery} onBack={() => setPage(Page.HOME)} />
      )}

      {page === Page.CHAT && activeChatId && (
          <div className="h-screen overflow-hidden">
              <ChatInterface 
                  session={chats.find(c => c.id === activeChatId)!}
                  characters={characters}
                  onUpdateSession={handleUpdateSession}
                  onUpdateCharacter={handleUpdateCharacter}
                  onBack={() => setPage(Page.HOME)}
                  onOpenDirectChat={(id) => handleStartDirectChat(id)}
                  onSaveToGallery={handleAddToGallery}
                  setGlobalError={setGlobalError}
                  sendMessageToAI={sendMessage}
                  onGenerateMedia={handleGenerateMedia}
                  onDeleteSession={() => {
                      if(window.confirm("Удалить этот чат?")) {
                          const newChats = chats.filter(c => c.id !== activeChatId);
                          setChats(newChats);
                          setActiveChatId(null);
                          setPage(Page.HOME);
                          triggerSave('ai_rpg_chats', newChats);
                      }
                  }}
              />
          </div>
      )}
    </div>
  );
};

export default App;
