import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className = '' }) => {
    return (
        <div className={`bg-[#00324D]/30 backdrop-blur-xl border border-white/10 rounded-xl shadow-lg ${className}`}>
            {children}
        </div>
    );
};

export default GlassCard;
