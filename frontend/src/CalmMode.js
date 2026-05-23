import React, { useState, useEffect, useMemo, useRef } from 'react';
import './index.css';

const CalmMode = ({ tasks, onExit, onTaskStatusChange }) => {
    // Sort and filter tasks: prioritize high priority, then incoming deadlines, filter out completed
    const activeTasks = useMemo(() => {
        return tasks
            .filter(t => t.status !== 'completed')
            .sort((a, b) => {
                // High priority first
                if (a.priority === 'high' && b.priority !== 'high') return -1;
                if (b.priority === 'high' && a.priority !== 'high') return 1;
                // Then by deadline
                if (a.deadline && b.deadline) {
                    return new Date(a.deadline) - new Date(b.deadline);
                }
                if (a.deadline) return -1;
                if (b.deadline) return 1;
                return 0;
            });
    }, [tasks]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPlayingMusic, setIsPlayingMusic] = useState(false);
    const [audioTrack, setAudioTrack] = useState('lofi');
    const [particles, setParticles] = useState([]);

    // Pomodoro Timer State
    const [timeLeft, setTimeLeft] = useState(25 * 60);
    const [isTimerRunning, setIsTimerRunning] = useState(false);

    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const oscillatorsRef = useRef([]);

    const audioSources = {
        lofi: "https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3"
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
        }
        if (oscillatorsRef.current.length > 0) {
            oscillatorsRef.current.forEach(osc => {
                try { osc.stop(); } catch (e) { }
                try { osc.disconnect(); } catch (e) { }
            });
            oscillatorsRef.current = [];
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
            audioCtxRef.current.close();
            audioCtxRef.current = null;
        }
    };

    const playAudio = () => {
        stopAudio();

        if (audioTrack === 'lofi') {
            audioRef.current = new Audio(audioSources.lofi);
            audioRef.current.loop = true;
            audioRef.current.volume = 0.4;
            audioRef.current.play().catch(e => console.error(e));
        } else {
            // Web Audio API Binaural Beat Synthesis
            try {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                const ctx = new AudioContext();
                audioCtxRef.current = ctx;

                const leftOsc = ctx.createOscillator();
                const rightOsc = ctx.createOscillator();
                const leftPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
                const rightPan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createPanner();
                const gainNode = ctx.createGain();

                // Add a lowpass filter to make it sound deeper and more ambient
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 400;

                // Base frequency of 200Hz for deep tone
                const baseFreq = 200;
                let diffFreq = audioTrack === 'gamma' ? 40 : 4; // 40Hz Gamma or 4Hz Theta

                leftOsc.type = 'sine';
                rightOsc.type = 'sine';
                leftOsc.frequency.value = baseFreq;
                rightOsc.frequency.value = baseFreq + diffFreq;

                if (ctx.createStereoPanner) {
                    leftPan.pan.value = -1;
                    rightPan.pan.value = 1;
                } else {
                    leftPan.setPosition(-1, 0, 0);
                    rightPan.setPosition(1, 0, 0);
                }

                // Keep the volume ambient and subtle
                gainNode.gain.value = 0.3;

                leftOsc.connect(leftPan);
                rightOsc.connect(rightPan);

                leftPan.connect(filter);
                rightPan.connect(filter);

                filter.connect(gainNode);
                gainNode.connect(ctx.destination);

                leftOsc.start();
                rightOsc.start();

                oscillatorsRef.current = [leftOsc, rightOsc];
            } catch (e) {
                console.error("Web Audio API not supported", e);
            }
        }
    };

    useEffect(() => {
        if (isPlayingMusic) {
            playAudio();
        } else {
            stopAudio();
        }

        return () => {
            stopAudio();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPlayingMusic, audioTrack]);

    // Generate particles
    useEffect(() => {
        const newParticles = Array.from({ length: 50 }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            top: Math.random() * 100,
            size: Math.random() * 4 + 1,
            animationDuration: Math.random() * 20 + 10,
            animationDelay: Math.random() * 5,
        }));
        setParticles(newParticles);
    }, []);

    // Pomodoro Timer Logic
    useEffect(() => {
        let interval;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setIsTimerRunning(false);
            // Could play a ding sound here
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const currentTask = activeTasks[currentIndex];

    const handleComplete = () => {
        if (currentTask) {
            onTaskStatusChange(currentTask, 'completed');
            // No need to increment currentIndex because activeTasks will remove the completed task,
            // and the next task will automatically fall into currentIndex.
        }
    };

    const handleSkip = () => {
        if (currentIndex < activeTasks.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setCurrentIndex(0); // loop back
        }
    };

    const aiMessages = [
        "Let's focus on one task at a time.",
        "Breathe in, breathe out. You're doing great.",
        "Small steps lead to big accomplishments.",
        "Focus on the present moment.",
        "You have the power to complete this.",
        "One thing at a time. No rush."
    ];
    const [message, setMessage] = useState(aiMessages[0]);

    // Update AI message every time currentIndex or activeTasks length changes
    useEffect(() => {
        setMessage(aiMessages[Math.floor(Math.random() * aiMessages.length)]);
        // eslint-disable-next-line
    }, [currentIndex, activeTasks.length]);

    return (
        <div
            className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-gradient-to-br transition-colors duration-1000 from-[#0b1121] via-[#1e1b4b] to-[#0f172a] text-white flex flex-col"
            style={{ zIndex: 9999 }}
        >
            {/* Background Particles */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
                {particles.map(p => (
                    <div
                        key={p.id}
                        className="absolute bg-purple-200/30 rounded-full animate-float blur-[1px]"
                        style={{
                            left: `${p.left}%`,
                            top: `${p.top}%`,
                            width: `${p.size}px`,
                            height: `${p.size}px`,
                            animationDuration: `${p.animationDuration}s`,
                            animationDelay: `${p.animationDelay}s`
                        }}
                    />
                ))}
            </div>

            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] mix-blend-screen" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            {/* Header / Controls */}
            <div className="relative z-10 w-full p-6 md:px-12 flex justify-between items-center bg-transparent">
                <button
                    onClick={onExit}
                    className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 group border border-transparent hover:border-white/10"
                >
                    <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Exit Focus Mode
                </button>

                <div className="flex items-center gap-4 bg-black/20 p-1.5 rounded-2xl backdrop-blur-md border border-white/5">
                    <select
                        value={audioTrack}
                        onChange={(e) => {
                            setAudioTrack(e.target.value);
                            setIsPlayingMusic(true);
                        }}
                        className="bg-transparent text-slate-300 text-sm font-medium border-none focus:outline-none cursor-pointer pl-2"
                    >
                        <option value="lofi" className="bg-slate-900">🎵 Ambient Lo-Fi</option>
                        <option value="gamma" className="bg-slate-900">🧠 40Hz Gamma (Deep Focus)</option>
                        <option value="theta" className="bg-slate-900">🌊 4Hz Theta (Stress Relief)</option>
                    </select>

                    <button
                        onClick={() => setIsPlayingMusic(!isPlayingMusic)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${isPlayingMusic ? 'bg-purple-500/20 border-purple-500/30 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.15)]' : 'border-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'}`}
                    >
                        {isPlayingMusic ? (
                            <div className="flex items-end gap-1 h-3.5 opacity-80">
                                <div className="w-1 bg-purple-400 animate-[pulse_1s_infinite] h-full rounded-full"></div>
                                <div className="w-1 bg-purple-400 animate-[pulse_0.8s_infinite] h-2/3 rounded-full"></div>
                                <div className="w-1 bg-purple-400 animate-[pulse_1.2s_infinite] h-full rounded-full"></div>
                                <div className="w-1 bg-purple-400 animate-[pulse_0.9s_infinite] h-1/2 rounded-full"></div>
                            </div>
                        ) : (
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        )}
                        <span className="text-sm font-medium tracking-wide">
                            {isPlayingMusic ? 'Playing' : 'Play Audio'}
                        </span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col items-center p-6 py-12 w-full max-w-2xl mx-auto min-h-min">
                {activeTasks.length > 0 ? (
                    <div className="w-full flex flex-col items-center w-[100%] transition-opacity duration-500">
                        {/* Progress & AI Message */}
                        <div className="text-center mb-10 w-full animate-[float_6s_ease-in-out_infinite_reverse]">
                            <div className="inline-flex flex-col items-center justify-center mb-6">
                                {/* Neurological Pomodoro Timer */}
                                <div className="text-6xl md:text-8xl font-light tracking-tighter text-white mb-6 drop-shadow-[0_0_30px_rgba(255,255,255,0.2)] font-mono flex items-center gap-6">
                                    <span className="w-[200px] md:w-[300px] tabular-nums text-center">{formatTime(timeLeft)}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setIsTimerRunning(!isTimerRunning)}
                                        className="px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium text-sm backdrop-blur-md transition-all uppercase tracking-widest"
                                    >
                                        {isTimerRunning ? 'Pause Sprint' : 'Start Focus Sprint'}
                                    </button>
                                    <button
                                        onClick={() => { setIsTimerRunning(false); setTimeLeft(25 * 60); }}
                                        className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-all"
                                        title="Reset Timer"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col items-center gap-3">
                                <div className="inline-flex items-center justify-center space-x-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 mt-4 backdrop-blur-sm shadow-xl">
                                    <span className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)] animate-pulse"></span>
                                    <span className="text-[10px] font-semibold text-purple-200/90 uppercase tracking-widest">
                                        Active Task {currentIndex + 1} of {activeTasks.length}
                                    </span>
                                </div>
                                <p className="text-slate-400 text-sm italic font-light max-w-md animate-pulse">
                                    "{message}"
                                </p>
                            </div>
                        </div>

                        {/* Task Card (Glassmorphism) */}
                        <div className="w-full bg-white/[0.03] backdrop-blur-[24px] rounded-[32px] p-8 md:p-12 border border-white/10 relative overflow-hidden group shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)] transform transition-transform hover:scale-[1.01] duration-500">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 opacity-70"></div>

                            <div className="flex flex-col items-center text-center">
                                {currentTask.priority === 'high' && (
                                    <span className="px-3 py-1 mb-6 rounded-full bg-red-500/10 border border-red-500/20 text-red-300 text-xs font-bold uppercase tracking-wider">
                                        High Priority
                                    </span>
                                )}

                                <h3 className="text-3xl md:text-4xl font-semibold mb-6 text-white leading-tight tracking-tight">
                                    {currentTask.title}
                                </h3>

                                {currentTask.description && (
                                    <p className="text-lg text-slate-300/80 mb-10 leading-relaxed font-light max-w-lg">
                                        {currentTask.description}
                                    </p>
                                )}

                                <div className="flex flex-col sm:flex-row items-center gap-5 w-full justify-center">
                                    <button
                                        onClick={handleComplete}
                                        className="w-full sm:w-auto px-8 py-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-medium text-lg transition-all duration-300 shadow-xl border border-white/10 hover:shadow-white/5 flex items-center justify-center gap-3 backdrop-blur-md hover:-translate-y-1 group/btn"
                                    >
                                        <div className="w-6 h-6 rounded-full border border-white/50 group-hover/btn:bg-white/50 group-hover/btn:border-white transition-all flex items-center justify-center">
                                            <svg className="w-4 h-4 text-transparent group-hover/btn:text-slate-900 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </div>
                                        Mark Complete
                                    </button>

                                    {activeTasks.length > 1 && (
                                        <button
                                            onClick={handleSkip}
                                            className="w-full sm:w-auto text-slate-400 hover:text-white hover:bg-white/5 px-6 py-4 rounded-2xl transition-all font-medium border border-transparent hover:border-white/5"
                                        >
                                            Skip for now
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center transform transition-all duration-700">
                        <div className="w-24 h-24 mx-auto mb-8 text-indigo-400/30">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.5" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                        </div>
                        <h2 className="text-4xl font-light text-white mb-4 tracking-tight">All caught up.</h2>
                        <p className="text-slate-400/80 text-xl mb-12 font-light">Take a moment to enjoy the peace.</p>
                        <button
                            onClick={onExit}
                            className="px-8 py-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all font-medium border border-white/10 text-slate-300 hover:text-white backdrop-blur-md"
                        >
                            Return to Dashboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CalmMode;
