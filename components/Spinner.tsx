import React from 'react';

const Spinner = ({ size = '8', color = 'sena-green' }: { size?: string, color?: string }) => {
  return (
    <div className={`w-${size} h-${size} border-4 border-t-transparent border-${color} rounded-full animate-spin`}></div>
  );
};

export default Spinner;