import { useEffect, useMemo, useRef, useState } from 'react';
import './general/modify_home.css';
import Popup from './components/Popup';
import { useNavigate } from 'react-router-dom';

interface HomeProps {
    setTrigger?: (value: boolean) => void;
    hideHeader?: boolean;
}

const emotions = [
    { name: 'NEUTRAL', className: 'neutral', img: './img/Neutral.png', imgPos: 'center 50%',rotate: -15 },
    { name: 'ANGRY', className: 'angry', img: './img/Anger.png', imgPos: 'center 58%',rotate: 2 },
    { name: 'HAPPY', className: 'happy', img: './img/Happy.png', imgPos: 'center 55%',rotate: -7 },
    { name: 'DISGUSTING', className: 'disgust', img: './img/Disgusting.png', imgPos: 'center 20%',rotate: 0 },
    { name: 'SAD', className: 'sad', img: './img/Sad.png', imgPos: 'center 42%' ,rotate: -10},
    { name: 'SURPRISE', className: 'surprise', img: './img/Surprise.png', imgPos: 'center 45%',rotate: 0 },
    { name: 'FEAR', className: 'fear', img: './img/alarm.png', imgPos: 'center 50%', rotate: 10 },
];


function Home(props: HomeProps) {
    const navigate = useNavigate();
    const [buttonPopup, setButtonPopup] = useState(false);
    const [angle, setAngle] = useState(0);
    const velocity = useRef(0);
    const wheelRef = useRef<HTMLDivElement | null>(null);

    const handleHomeMod = () => {
        navigate('/general/AboutUs');
        props.setTrigger?.(false);
    };

    const handleHome = () => {
        navigate('/');
        if (props.setTrigger) props.setTrigger(false);
    };

    useEffect(() => {
        let frame: number;
        let lastTime = performance.now();

        const ROTATION_SPEED = 14; // degrees per second

        const animate = (now: number) => {
            const delta = (now - lastTime) / 1000;
            lastTime = now;

            setAngle((prev) => (prev + ROTATION_SPEED * delta) % 360);
            frame = requestAnimationFrame(animate);
        };

        frame = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(frame);
    }, []);

    return (
        <>
        <svg className="box-grid-svg-filter">
            <defs>
                <filter id="wavy">
                    <feTurbulence type="turbulence" baseFrequency="0.012" numOctaves="2" seed="2" result="noise" />
                    <feDisplacementMap in="SourceGraphic" in2="noise" scale="18" xChannelSelector="R" yChannelSelector="G" />
                </filter>
            </defs>
        </svg>
        <div data-testid="cypress-title" className="Homecontainer">
            <div className="box-grid-bg" />
            <div style={{ position: 'relative', zIndex: 1 }}>
                <div className="Content">
            <div className="TopContent">
                <div className="logo">
                    {!props.hideHeader && (
                        <>
                        <div className="nav-item" onClick={handleHome}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 169.66 162.31" width="60" height="60">
                                        <defs>
                                            <style>{`
                                            .cls-1 { fill: #d8903a; }
                                            .cls-2 { fill: #f5cd9e; }
                                            .cls-2, .cls-3, .cls-4, .cls-5, .cls-6 { stroke-miterlimit: 10; }
                                            .cls-2, .cls-4, .cls-5, .cls-6 { stroke: #93551a; }
                                            .cls-3 { fill: #c88635; stroke: #f5cd9e; }
                                            .cls-4 { fill: none; }
                                            .cls-7 { fill: #fff; }
                                            .cls-7, .cls-5 { font-family: ForteMT, Forte; font-size: 125px; }
                                            .cls-8 { opacity: .5; }
                                            .cls-8, .cls-5 { fill: #93551a; }
                                            .cls-6 { fill: #f4ceb3; }
                                            `}</style>
                                        </defs>
                                        <g id="Layer_1" data-name="Layer 1">
                                            <g>
                                            <path className="cls-1" d="M62.85,15.14c-.12,1.3-2.69-1.98-4.45-2.21s-2,1.63-2.28,2.84-1.12,4.02.87,5.94,6.85,3.29,6.39,4.49-4.93-.98-7.76-.86-3.99,2.74-4.6,3.85-2.15,3.56-.73,5.95,5.71,4.99,4.96,6.03-4.5-2.25-7.26-2.88-4.57,1.6-5.44,2.51-2.99,2.88-2.24,5.56,4.23,6.29,3.23,7.1-3.78-3.33-6.28-4.64-4.82.39-5.9,1.05-3.61,2.04-3.55,4.82,2.52,7.15,1.34,7.69-2.82-4.17-4.92-6.07-4.77-.82-5.98-.44-3.99,1.08-4.63,3.79.67,7.55-.6,7.78-3.46-4.38-6.16-5.81-4.84-.24-6.12-.17c-.63,2.15-.14,3.99,2.54,5.5,2.53,1.42,7.67,1.38,7.67,3.5s-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.75-2.61,5.92c0,2.45-.76,4.53.96,4.79,1.34.21,4.13-2.81,5.77-1.84,2.96,1.76,1.9,6.36,3.13,8.16,1.38,2.02,4.19.9,8.05.9,3.66,0,6.86.22,8.69-2.28s2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.87.22,8.69-2.28,2.28-7.72,5.94-7.72c3.35,0,5.09,5.79,7.8,8.41,3.21,3.11,6.15,3.41,9.06.71,2.71-2.5,2.35-5.3-.7-8.5-2.54-2.66-8.24-4.36-8.24-7.42,0-3.38,5.16-3.65,7.66-5.34s2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.17-3.65,7.67-5.34,2.33-4.79,2.33-8.17c0-3.61,1.11-6.28-.87-7.47-1.72-1.04-6.1.39-7.91-2.19-1.21-1.72,1.58-4.85,1.24-6.25-.42-1.77-2.62-.9-5.26-.9-2.38,0-5.11.06-6.3,2.56s-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.29-2.56-5.11.06-6.29,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-4.93-.04-5.84,2.34c-.85,2.23.33,6.81-1.89,7.42s-3.6-2.96-4.82-3.27-1.83,2.37-4.14,2.98Z"/>
                                            <path className="cls-4" d="M62.85,15.14c-.12,1.3-2.69-1.98-4.45-2.21s-2,1.63-2.28,2.84-1.12,4.02.87,5.94,6.85,3.29,6.39,4.49-4.93-.98-7.76-.86-3.99,2.74-4.6,3.85-2.15,3.56-.73,5.95,5.71,4.99,4.96,6.03-4.5-2.25-7.26-2.88-4.57,1.6-5.44,2.51-2.99,2.88-2.24,5.56,4.23,6.29,3.23,7.1-3.78-3.33-6.28-4.64-4.82.39-5.9,1.05-3.61,2.04-3.55,4.82,2.52,7.15,1.34,7.69-2.82-4.17-4.92-6.07-4.77-.82-5.98-.44-3.99,1.08-4.63,3.79.67,7.55-.6,7.78-3.46-4.38-6.16-5.81-4.84-.24-6.12-.17c-.63,2.15-.14,3.99,2.54,5.5,2.53,1.42,7.67,1.38,7.67,3.5s-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.74-2.61,5.92.11,4.83,2.61,5.92,7.39.61,7.39,2.79-4.89,1.7-7.39,2.79-2.61,3.75-2.61,5.92c0,2.45-.76,4.53.96,4.79,1.34.21,4.13-2.81,5.77-1.84,2.96,1.76,1.9,6.36,3.13,8.16,1.38,2.02,4.19.9,8.05.9,3.66,0,6.86.22,8.69-2.28s2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.86.22,8.69-2.28,2.28-7.72,5.93-7.72,4.1,5.22,5.93,7.72,5.03,2.28,8.69,2.28,6.87.22,8.69-2.28,2.28-7.72,5.94-7.72c3.35,0,5.09,5.79,7.8,8.41,3.21,3.11,6.15,3.41,9.06.71,2.71-2.5,2.35-5.3-.7-8.5-2.54-2.66-8.24-4.36-8.24-7.42,0-3.38,5.16-3.65,7.66-5.34s2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.16-3.65,7.66-5.34,2.34-4.79,2.34-8.17.16-6.48-2.34-8.17-7.66-1.96-7.66-5.34,5.17-3.65,7.67-5.34,2.33-4.79,2.33-8.17c0-3.61,1.11-6.28-.87-7.47-1.72-1.04-6.1.39-7.91-2.19-1.21-1.72,1.58-4.85,1.24-6.25-.42-1.77-2.62-.9-5.26-.9-2.38,0-5.11.06-6.3,2.56s-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.29-2.56-5.11.06-6.29,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-5.11.06-6.3,2.56-.83,7.44-3.21,7.44-2.02-4.94-3.21-7.44-3.92-2.56-6.3-2.56-4.93-.04-5.84,2.34c-.85,2.23.33,6.81-1.89,7.42s-3.6-2.96-4.82-3.27-1.83,2.37-4.14,2.98Z"/>
                                            </g>
                                            <g>
                                            <path className="cls-1" d="M41.68,28.28c-.43.53-.63.62-1.25.91s-.69.13-1.31.42-.93-.38-1.55-.09-.44.98-1.1.81-.84-.21-1.23-.77.05-.87-.34-1.43.14-.93-.25-1.49-.65-.17-.76-.85-.79-.7-.61-1.38.93-.48,1.11-1.16-.34-.82-.16-1.5-.13-.77.05-1.45.57-.57,1.01-1.12.38-.63.99-.92.46-.63,1.07-.92.76,0,1.38-.28.6-.12,1.26.05,1.04-.2,1.43.36.32.61.71,1.17.45.52.84,1.08.38.78.49,1.46-1.03.57-1.21,1.25-.02.72-.21,1.4.13.76-.05,1.44.29.69.29,1.4c0,.83-.17,1.05-.62,1.59Z"/>
                                            <path className="cls-4" d="M41.68,28.28c-.43.53-.63.62-1.25.91s-.69.13-1.31.42-.93-.38-1.55-.09-.44.98-1.1.81-.84-.21-1.23-.77.05-.87-.34-1.43.14-.93-.25-1.49-.65-.17-.76-.85-.79-.7-.61-1.38.93-.48,1.11-1.16-.34-.82-.16-1.5-.13-.77.05-1.45.57-.57,1.01-1.12.38-.63.99-.92.46-.63,1.07-.92.76,0,1.38-.28.6-.12,1.26.05,1.04-.2,1.43.36.32.61.71,1.17.45.52.84,1.08.38.78.49,1.46-1.03.57-1.21,1.25-.02.72-.21,1.4.13.76-.05,1.44.29.69.29,1.4c0,.83-.17,1.05-.62,1.59Z"/>
                                            </g>
                                            <g>
                                            <path className="cls-1" d="M17.68,43.78c-.46.46-.74.55-1.37.72s-.68-.02-1.32.14-.84-.63-1.47-.46-.56.44-1.19.61-.47.8-1.1.97-.79-.07-1.42-.24.04-.97-.42-1.43-.53-.39-.99-.85-1.25.32-1.71-.14.14-1.07-.32-1.53-.89-.04-1.36-.5-1.17-.31-1.34-.94.93-.74,1.1-1.37-.29-.75-.12-1.38-.23-.74-.06-1.37.53-.53.7-1.16.9-.44,1.07-1.07-1.07-1.45-.61-1.91.99-.28,1.62-.44.61-.24,1.24-.41.75.27,1.38.1.88.77,1.51.6.59-.34,1.22-.51.47-.85,1.1-.69.92-.09,1.38.37-.35,1.27.11,1.73.48.44.95.9.9.03,1.36.49.77.16,1.23.63,1.12.46,1.29,1.1-.92.82-1.09,1.45-.48.55-.65,1.18.81.89.64,1.52-1.23.35-1.4.98-.2.73-.18,1.38c.03.81.67,1.08.21,1.54Z"/>
                                            <path className="cls-4" d="M17.68,43.78c-.46.46-.74.55-1.37.72s-.68-.02-1.32.14-.84-.63-1.47-.46-.56.44-1.19.61-.47.8-1.1.97-.79-.07-1.42-.24.04-.97-.42-1.43-.53-.39-.99-.85-1.25.32-1.71-.14.14-1.07-.32-1.53-.89-.04-1.36-.5-1.17-.31-1.34-.94.93-.74,1.1-1.37-.29-.75-.12-1.38-.23-.74-.06-1.37.53-.53.7-1.16.9-.44,1.07-1.07-1.07-1.45-.61-1.91.99-.28,1.62-.44.61-.24,1.24-.41.75.27,1.38.1.88.77,1.51.6.59-.34,1.22-.51.47-.85,1.1-.69.92-.09,1.38.37-.35,1.27.11,1.73.48.44.95.9.9.03,1.36.49.77.16,1.23.63,1.12.46,1.29,1.1-.92.82-1.09,1.45-.48.55-.65,1.18.81.89.64,1.52-1.23.35-1.4.98-.2.73-.18,1.38c.03.81.67,1.08.21,1.54Z"/>
                                            </g>
                                            <g>
                                            <path className="cls-4" d="M22.07,8.54c-.42.5-.65.46-1.27.7s-.66.12-1.27.36-.65.18-1.29,0-.44-.34-.86-.85-.71-.27-1.13-.78-.45-.6-.56-1.24c-.13-.76.61-.63.8-1.38s.14-.76.34-1.5-.67-1.18-.17-1.77c.42-.5.91.15,1.53-.08s.49-.57,1.11-.8.74-.85,1.37-.68.24.92.65,1.43.63.34,1.05.85,1,.41,1.11,1.06c.13.76-.42.86-.62,1.6s-.8.66-.84,1.43c-.04.85.53,1.06.04,1.65Z"/>
                                            <path className="cls-1" d="M22.07,8.54c-.42.5-.65.46-1.27.7s-.66.12-1.27.36-.65.18-1.29,0-.44-.34-.86-.85-.71-.27-1.13-.78-.45-.6-.56-1.24c-.13-.76.61-.63.8-1.38s.14-.76.34-1.5-.67-1.18-.17-1.77c.42-.5.91.15,1.53-.08s.49-.57,1.11-.8.74-.85,1.37-.68.24.92.65,1.43.63.34,1.05.85,1,.41,1.11,1.06c.13.76-.42.86-.62,1.6s-.8.66-.84,1.43c-.04.85.53,1.06.04,1.65Z"/>
                                            </g>
                                        </g>
                                        <g id="Layer_2" data-name="Layer 2">
                                            <text className="cls-5" transform="translate(24.47 113.85) scale(1.4 1)"><tspan x="0" y="0">m</tspan></text>
                                            <text className="cls-7" transform="translate(11.08 113.85) scale(1.4 1)"><tspan x="0" y="0">m</tspan></text>
                                        </g>
                                        <g id="Layer_3" data-name="Layer 3">
                                            <circle className="cls-3" cx="91.79" cy="41.94" r="4"/>
                                            <circle className="cls-6" cx="137.29" cy="41.94" r="4"/>
                                            <circle className="cls-8" cx="46.29" cy="132.67" r="4"/>
                                            <circle className="cls-2" cx="42.29" cy="132.67" r="4"/>
                                            <circle className="cls-8" cx="95.04" cy="132.67" r="4"/>
                                            <circle className="cls-6" cx="91.79" cy="132.67" r="4"/>
                                            <circle className="cls-8" cx="136.54" cy="132.67" r="4"/>
                                            <circle className="cls-3" cx="133.29" cy="132.67" r="4"/>
                                        </g>
                                    </svg>
                        </div>
                        </>
                        )}
                </div>
                <div className="About" onClick={handleHomeMod}>About us</div>
            </div>
                <div
                    ref={wheelRef}
                    className="Wheel"
                >
                    {emotions.map((emotion, i) => {
                        const theta = (2 * Math.PI * i) / emotions.length + (angle * Math.PI / 180);
                        const w = window.innerWidth;
                        const isLandscape1020 = window.matchMedia('(min-width: 1020px) and (max-width: 1079px) and (orientation: landscape)').matches;
                        const isLandscape1280 = window.matchMedia('(min-width: 1280px) and (max-width: 1281px) and (orientation: landscape)').matches;
                        const rx = isLandscape1020 ? 300 : isLandscape1280 ? 350 : w <= 415 ? 130 : w <= 780 ? 260 : w <= 820 ? 290 : w <= 1030 ? 360 : 340;
                        const ry = isLandscape1020 ? 150 : isLandscape1280 ? 160 : w <= 415 ? 80  : w <= 780 ? 180 : w <= 820 ? 190 : w <= 1030 ? 260 : 200;

                        const x = Math.cos(theta) * rx;
                        const y = -Math.sin(theta) * ry;

                        return (
                            <div
                                key={i}
                                className={`wheel-card ${emotion.className}`}
                                style={{
                                    left: `calc(50% + ${x}px)`,
                                    top: `calc(50% + ${y}px)`,
                                    transform: `translate(-50%, -50%) rotate(${emotion.rotate ?? 0}deg)`,

                                }}
                            >
                                <div className="card-inner">
                                    <img src={emotion.img} alt={emotion.name} style={{ objectPosition: emotion.imgPos }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            <div className="MiddleContent">
                <div className='sticker-1'>
                    <img src="./img/stc1.png"></img>
                </div>
                <div className='sticker-2'>
                    <img src="./img/stc2.png"></img>
                </div>
                <div className='sticker-3'>
                    <img src="./img/stc3.png"></img>
                </div>
                <div className="hero-section">
                <div className="text-left">MOOD!</div>
                <div className="text-right">
                    CRACK
                    <br />
                    <div className="text-low-right">
                    e<span className="oblique-char">r</span>
                    </div>
                </div>
                </div>

                <button className="buttonFind" onClick={() => setButtonPopup(true)}>
                <p>start</p>
                </button>


            </div>

            <div className="BottomContent">
            <div
                className="emotional"
                style={
                {
                    '--width': '150px',
                    '--height': '70px',
                    '--quantity': 7,
                    } as React.CSSProperties
                }
            >
                <div className="emotional-panel">
                    <div className="dot" style={{ '--position': 1 } as React.CSSProperties}><span className="label">NEUTRAL</span></div>
                    <div className="dot" style={{ '--position': 2 } as React.CSSProperties}><span className="label">ANGRY</span></div>
                    <div className="dot" style={{ '--position': 3 } as React.CSSProperties}><span className="label">HAPPY</span></div>
                    <div className="dot" style={{ '--position': 4 } as React.CSSProperties}><span className="label">DISGUSTING</span></div>
                    <div className="dot" style={{ '--position': 5 } as React.CSSProperties}><span className="label">SAD</span></div>
                    <div className="dot" style={{ '--position': 6 } as React.CSSProperties}><span className="label">SURPRISE</span></div>
                    <div className="dot" style={{ '--position': 7 } as React.CSSProperties}><span className="label">FEAR</span></div>
                </div>
            </div>
            </div>
            </div>
            </div>

            

        <Popup trigger={buttonPopup} setTrigger={setButtonPopup} />
        </div>
    </>
    );
}

export default Home;