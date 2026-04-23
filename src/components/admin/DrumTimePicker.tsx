'use client';

import React, { useState, useEffect, useRef } from 'react';

interface DrumTimePickerProps {
    value: string; // "YYYY-MM-DDTHH:mm" or "HH:mm"
    onChange: (value: string) => void;
    className?: string;
}

export default function DrumTimePicker({ value, onChange, className }: DrumTimePickerProps) {
    const [datePart, setDatePart] = useState('');
    const [hours, setHours] = useState('00');
    const [minutes, setMinutes] = useState('00');
    const [isOpen, setIsOpen] = useState(false);
    
    const hourRef = useRef<HTMLDivElement>(null);
    const minuteRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (value && value.includes('T')) {
            const [d, t] = value.split('T');
            setDatePart(d);
            const [h, m] = t.split(':');
            setHours(h || '00');
            setMinutes(m || '00');
        } else if (value && value.includes(':')) {
            const [h, m] = value.split(':');
            setHours(h || '00');
            setMinutes(m || '00');
        }
    }, [value]);

    const updateValue = (h: string, m: string) => {
        const timeStr = `${h}:${m}`;
        if (datePart) {
            onChange(`${datePart}T${timeStr}`);
        } else {
            onChange(timeStr);
        }
    };

    const handleHourChange = (h: string) => {
        setHours(h);
        updateValue(h, minutes);
    };

    const handleMinuteChange = (m: string) => {
        setMinutes(m);
        updateValue(hours, m);
    };

    const scrollToValue = (ref: React.RefObject<HTMLDivElement>, val: string) => {
        if (ref.current) {
            const el = ref.current.querySelector(`[data-value="${val}"]`);
            if (el) {
                el.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            
            if (e.key >= '0' && e.key <= '9') {
                // Determine if we are typing hour or minute based on focus or sequence
                // For simplicity, let's say we type 4 digits for HHMM
                // Or just use a simple state to track sequence
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen]);

    // Improved logic: Let's use a standard hidden input to capture typing if needed, 
    // or just listen to keys globally when open.
    // Let's implement a "typing buffer".
    const [typeBuffer, setTypeBuffer] = useState('');
    useEffect(() => {
        if (!isOpen) {
            setTypeBuffer('');
            return;
        }
        const timer = setTimeout(() => setTypeBuffer(''), 2000); // Reset buffer after 2s
        return () => clearTimeout(timer);
    }, [typeBuffer, isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key >= '0' && e.key <= '9') {
                const newBuffer = (typeBuffer + e.key).slice(-4);
                setTypeBuffer(newBuffer);
                
                if (newBuffer.length === 1 || newBuffer.length === 2) {
                    const h = newBuffer.padStart(2, '0');
                    if (parseInt(h) < 24) {
                        setHours(h);
                        updateValue(h, minutes);
                    }
                } else if (newBuffer.length === 3 || newBuffer.length === 4) {
                    const h = newBuffer.slice(0, 2);
                    const m = newBuffer.slice(2).padStart(2, '0');
                    if (parseInt(m) < 60) {
                        setMinutes(m);
                        updateValue(h, m);
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, typeBuffer, hours, minutes]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                scrollToValue(hourRef, hours);
                scrollToValue(minuteRef, minutes);
            }, 50);
        }
    }, [isOpen, hours, minutes]);

    const hourOptions = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minuteOptions = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    return (
        <div className={`relative inline-block ${className}`}>
            <div 
                className="flex items-center border rounded px-2 py-1 bg-white cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="text-sm font-mono">{hours}:{minutes}</span>
                <svg className="w-4 h-4 ml-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-[60]" onClick={() => setIsOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-xl z-[70] flex p-2 gap-2 animate-in fade-in zoom-in duration-150">
                        {/* Hours Drum */}
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 font-bold mb-1">時</span>
                            <div 
                                ref={hourRef}
                                className="h-32 w-12 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            >
                                {hourOptions.map(h => (
                                    <div 
                                        key={h}
                                        data-value={h}
                                        onClick={() => handleHourChange(h)}
                                        className={`h-8 flex items-center justify-center cursor-pointer snap-center transition-all ${hours === h ? 'bg-indigo-600 text-white font-bold rounded' : 'hover:bg-gray-100 text-gray-600'}`}
                                    >
                                        {h}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center text-gray-300 font-bold">:</div>

                        {/* Minutes Drum */}
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-gray-400 font-bold mb-1">分</span>
                            <div 
                                ref={minuteRef}
                                className="h-32 w-12 overflow-y-auto scrollbar-hide snap-y snap-mandatory"
                            >
                                {minuteOptions.map(m => (
                                    <div 
                                        key={m}
                                        data-value={m}
                                        onClick={() => handleMinuteChange(m)}
                                        className={`h-8 flex items-center justify-center cursor-pointer snap-center transition-all ${minutes === m ? 'bg-indigo-600 text-white font-bold rounded' : 'hover:bg-gray-100 text-gray-600'}`}
                                    >
                                        {m}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            <style jsx>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
}
