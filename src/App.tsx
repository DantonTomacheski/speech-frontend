import RealTimeTranscription from './components/RealTimeTranscription';
import './index.css';

function App() {
  const waveformBars = Array.from({ length: 30 }, () => Math.floor(Math.random() * 60) + 20);

  return (
    <div className="min-w-screen min-h-screen bg-gradient-primary noise-bg flex">
      <div className="m-auto w-[95%] max-w-md">
        <header className="flex justify-between items-center mb-4 px-1">
          <h1 className="text-2xl text-white font-semibold">
            VoiceTranscription
          </h1>
          <div className="text-xs">
            <span className="inline-block px-2 py-1 rounded-full bg-accent-blue bg-opacity-20 text-accent-blue">
              v1.0
            </span>
          </div>
        </header>
        
        <div className="rounded-3xl border border-white border-opacity-20 shadow-glow-blue overflow-hidden">
          <div className="glassmorphism p-6 relative pb-10">
            <RealTimeTranscription />
            
            <div className="absolute bottom-0 left-0 right-0 h-8 overflow-hidden bg-primary-dark/10">
              <div className="flex justify-between items-end w-full h-full px-1">
                {waveformBars.map((height, index) => (
                  <div 
                    key={index}
                    className="bg-accent-turquoise/40 rounded-t-sm"
                    style={{
                      height: `${height}%`,
                      width: '2px',
                      maxHeight: '100%',
                      animation: `voiceWave 0.8s ease-in-out infinite alternate`,
                      animationDelay: `${index * 0.03}s`,
                      transformOrigin: 'bottom'
                    }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        <nav className="flex justify-center space-x-12 text-text-secondary mt-6">
          <button className="p-2 hover:text-accent-turquoise transition-colors focus:outline-none" aria-label="Home">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7m-14 0l2 2m0 0l7 7 7-7m-14 0l2-2" />
            </svg>
          </button>
          <button className="p-2 text-accent-turquoise transition-colors focus:outline-none" aria-label="Record">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button className="p-2 hover:text-accent-turquoise transition-colors focus:outline-none" aria-label="Settings">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </nav>
      </div>
    </div>
  );
}

export default App;