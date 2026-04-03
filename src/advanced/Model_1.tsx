import { useEffect, useRef, useState } from 'react';
import './Model.css'
import { useNavigate } from 'react-router-dom';
import Core_Ad from './core_advanced';

interface ModelProps {
  setTrigger?: (value: boolean) => void;
}

function model1(props: ModelProps) {
{/*
const section2Ref = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.6 }
    );

    if (section2Ref.current) {
      observer.observe(section2Ref.current);
    }

    return () => {
      if (section2Ref.current) {
        observer.unobserve(section2Ref.current);
      }
    };
  }, []);  */}

  const navigate = useNavigate();

  const handleHome = () => {
        navigate('/');
        if (props.setTrigger) {
          props.setTrigger(false);
        }
    };

  const handleExplore = () => {
    navigate('/advanced/Compare');
      if (props.setTrigger) {
          props.setTrigger(false);
      }
  };

  const handleBack = () => {
    navigate('/advanced');
      if (props.setTrigger) {
          props.setTrigger(false);
      }
  };

  const handleTechInfo = () => {
    navigate('/advanced/TechInfo');
      if (props.setTrigger) {
          props.setTrigger(false);
      }
  };

  return (
    <div className="container-m">
        <div className='page-m'>  
            <Core_Ad></Core_Ad>
        </div>   
    </div>
  );
}

export default model1;