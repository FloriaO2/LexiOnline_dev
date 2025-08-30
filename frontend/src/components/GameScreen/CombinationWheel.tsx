import React, { useEffect, useRef, useState } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { EffectCoverflow, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import './CombinationWheel.css';

interface CombinationWheelProps {
  currentCombination: string;
  lastType: number;
  lastMadeType: number;
}

const CombinationWheel: React.FC<CombinationWheelProps> = ({ 
  currentCombination, 
  lastType, 
  lastMadeType 
}) => {
  const swiperRef = useRef<any>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // 조합 이름들을 순서대로 정의 (위에서 아래로 갈수록 높은 조합)
  const combinationNames = [
    '미등록',
    '싱글',
    '원페어',
    '트리플',
    '포카드',
    '스트레이트',
    '플러시',
    '풀하우스',
    '스트레이트플러시'
  ];

  // 현재 조합에 해당하는 인덱스 찾기
  const getCombinationIndex = (combination: string): number => {
    return combinationNames.findIndex(name => name === combination);
  };

  // 이전 조합과 현재 조합을 비교하여 애니메이션 방향 결정
  const getAnimationDirection = (prevIndex: number, currentIndex: number): 'up' | 'down' => {
    if (prevIndex === -1 || currentIndex === -1) return 'down';
    
    // 미등록(0)에서 다른 조합으로 가면 아래로
    if (prevIndex === 0 && currentIndex > 0) return 'down';
    
    // 다른 조합에서 미등록(0)으로 가면 위로
    if (currentIndex === 0 && prevIndex > 0) return 'up';
    
    // 일반적인 경우: 인덱스가 증가하면 아래로, 감소하면 위로
    return currentIndex > prevIndex ? 'down' : 'up';
  };

  useEffect(() => {
    const newIndex = getCombinationIndex(currentCombination);
    
    if (newIndex !== -1 && newIndex !== currentIndex && swiperRef.current) {
      setIsAnimating(true);
      
      // 애니메이션 방향 결정
      const direction = getAnimationDirection(currentIndex, newIndex);
      
      // 단계별 애니메이션 실행
      const animateStepByStep = async () => {
        const steps = Math.abs(newIndex - currentIndex);
        const stepDelay = 100; // 각 단계별 지연 시간 (더 빠르게)
        
        if (steps === 1) {
          // 한 칸만 이동하는 경우
          swiperRef.current.swiper.slideTo(newIndex, 200, false);
          setCurrentIndex(newIndex);
          setTimeout(() => setIsAnimating(false), 200);
        } else {
          // 여러 칸을 이동하는 경우 - 단계별로 실행하되 더 빠르게
          const startIndex = currentIndex;
          const stepDirection = direction === 'down' ? 1 : -1;
          
          // 각 단계를 순차적으로 실행 (더 빠른 속도로)
          for (let i = 1; i <= steps; i++) {
            const stepIndex = startIndex + (stepDirection * i);
            
            setTimeout(() => {
              if (swiperRef.current && swiperRef.current.swiper) {
                swiperRef.current.swiper.slideTo(stepIndex, 150, false);
                setCurrentIndex(stepIndex);
              }
            }, (i - 1) * stepDelay);
          }
          
          // 최종 위치로 이동하고 애니메이션 완료
          setTimeout(() => {
            if (swiperRef.current && swiperRef.current.swiper) {
              swiperRef.current.swiper.slideTo(newIndex, 150, false);
              setCurrentIndex(newIndex);
            }
            setTimeout(() => setIsAnimating(false), 150);
          }, steps * stepDelay);
        }
      };
      
      animateStepByStep();
    }
  }, [currentCombination, lastType, lastMadeType]);

  return (
    <div className="combination-wheel-container">
      <Swiper
        ref={swiperRef}
        direction="vertical"
        effect="coverflow"
        grabCursor={false}
        allowTouchMove={false}
        modules={[EffectCoverflow, Autoplay]}
        coverflowEffect={{
          rotate: 0,
          stretch: 0,
          depth: 100,
          modifier: 1,
          slideShadows: false,
        }}
        className="combination-swiper"
        initialSlide={0}
        speed={200}
        spaceBetween={0}
        slidesPerView={3}
        centeredSlides={true}
        loop={false}
      >
        {combinationNames.map((name, index) => (
          <SwiperSlide key={index} className="combination-slide">
            <div className={`combination-item ${index === currentIndex ? 'active' : ''}`}>
              {name}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
};

export default CombinationWheel; 