import React, { useState, useEffect, useRef } from 'react';

const AIChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, sender: 'ai', text: "Hello! I'm IntelliBot. How can I assist you with your tasks today?" }
    ]);
    const [input, setInput] = useState("");
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        // User message
        const userMsg = { id: Date.now(), sender: 'user', text: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");

        // Show thinking state
        const thinkingId = Date.now() + 1;
        setMessages(prev => [...prev, { id: thinkingId, sender: 'ai', text: "Checking systems..." }]);

        try {
            const storedUserStr = localStorage.getItem('user');
            const storedUser = storedUserStr ? JSON.parse(storedUserStr) : null;

            const response = await fetch("https://intellitasker.onrender.com/api/chat", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    message: userMsg.text,
                    userId: storedUser ? storedUser.id : null,
                    name: storedUser ? storedUser.name : null
                })
            });

            const data = await response.json();

            setMessages(prev => prev.filter(msg => msg.id !== thinkingId).concat({
                id: Date.now() + 2,
                sender: 'ai',
                text: data.reply || data.error || "I am currently offline or encountering a malfunction, Sir."
            }));
        } catch (error) {
            console.error("AI chat error:", error);
            setMessages(prev => prev.filter(msg => msg.id !== thinkingId).concat({
                id: Date.now() + 2,
                sender: 'ai',
                text: "Communication Error: Unable to reach the main servers. Please check if the backend is running."
            }));
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 md:w-96 h-96 bg-[#0f172a]/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up transition-all">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                                <span className="text-lg">🤖</span>
                            </div>
                            <div>
                                <h3 className="text-white font-semibold text-sm">IntelliBot</h3>
                                <p className="text-blue-400 text-xs flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
                                    Online
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.sender === 'user'
                                        ? 'bg-blue-600 text-white rounded-br-none'
                                        : 'bg-slate-700/50 text-slate-200 border border-slate-600/50 rounded-bl-none'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 bg-black/20 border-t border-white/5">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask AI assistant..."
                                className="w-full bg-slate-800/50 text-white text-sm rounded-xl pl-4 pr-10 py-3 border border-slate-700/50 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-slate-500"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-blue-400"
                            >
                                <svg className="w-4 h-4 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Floating Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`group relative flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg hover:shadow-blue-500/30 transition-all duration-300 ${isOpen ? 'bg-slate-700 text-slate-300 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:scale-105'
                    }`}
            >
                {isOpen ? (
                    <svg className="w-6 h-6 transform -rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500/80 rounded-full animate-ping"></span>
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                    </>
                )}
            </button>
        </div>
    );
};

export default AIChatbot;
