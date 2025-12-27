# 🎲 LexiOnline

**렉시오 온라인, 실시간 전략 카드 게임**

---

![logo.png](attachment:5324a32b-f418-48bb-91df-11b74e0c44b1:logo.png)

## 🤷 What is LexiOnline?

**LexiOnline은 이런 게임입니다.**

✅ 3-5명이 동시에 즐길 수 있는 **온라인 보드게임**

✅ 전략적 사고와 **순위 시스템** 기반의 경쟁

✅ **구글 로그인**으로 손쉽게 시작, 실시간 플레이 가능

✅ 다양한 **패 렌더링 모드** 제공

✅ **Rating 시스템**을 통해 유저의 실력을 반영하는 점수 시스템

---

## 🫵 Who use LexiOnline?

**LexiOnline은 이런 분에게 적합합니다!**

✅ 전략적 사고를 즐기는 **보드게임 애호가**

✅ **실시간으로 다른 유저들과 경쟁**하고 싶은 분

✅ **순위 시스템**에 따라 자기 실력을 반영받고 싶은 분

---

## 🛠️ 기술 스택

> Frontend
> 
> - `React` - 사용자 인터페이스

> Backend
> 
> - `Colyseus` - 백엔드 게임 진행
> - `Google Console Storage` - 구글 로그인을 위한 길고 험난한 여정

> DB
> 
> - `Prisma` - 데이터베이스

---

## 🎮 LexiOnline의 주요 기능

## [Fun 1] 게임 로비와 방 생성

---

![Lobby1.gif](attachment:81fadb22-f2c4-49da-adc8-6d28825b71e6:Lobby1.gif)

![Lobby2.gif](attachment:e3efb55f-41a4-4db0-a703-c85c9d59460a:Lobby2.gif)

![Lobby3.gif](attachment:74ccb64d-df0a-48b6-a1b4-579022f7768f:Lobby3.gif)

### 손쉽게 방을 만들고 참가하세요!

**✅ 구글 로그인 → 방 생성/참가 → 대기실로 이동**

1. 구글 로그인을 통해 **즉시 게임 시작** 가능
2. 방을 만들 때 **닉네임** 설정 후 방 생성
3. 방 참가 시 **방 코드**를 입력하여 참여

---

## [Fun 2] 대기실에서의 방 관리 및 게임 시작

---

![Waiting1.gif](attachment:bc563680-5919-42ea-ab1d-dad5f0e9a100:Waiting1.gif)

### 게임 대기실에서 실시간으로 준비 상태 관리

**✅ 준비 상태 변경 → 실시간으로 반영**

1. 방 생성자는 **라운드 수**를 조정 가능
2. 모든 유저는 **준비하기 버튼**을 클릭하여 준비 상태로 변경
3. 준비 완료된 유저 목록은 실시간으로 동기화

---

## [Fun 3] 게임 모드 선택

---

![스크린샷 2025-07-31 182551.png](attachment:9a7f8458-0d5b-4cc4-a422-9e7944880888:스크린샷_2025-07-31_182551.png)

![스크린샷 2025-07-31 182612.png](attachment:e3340fb7-e52d-4762-985b-553acde1a5be:스크린샷_2025-07-31_182612.png)

### 초보 모드 또는 일반 모드로 플레이

**✅ 모드 선택 → 초보 모드 시 직관적인 패 렌더링**

1. 각 유저는 **초보 모드/일반 모드** 선택 가능
2. 일반 모드에서는 실제 **렉시오** 패를, 초보 모드에서는 보다 더 직관적인 **금은동** 패를 사용

---

## [Fun 4] 게임 화면에서 자신만의 전략을 펼치세요!

---

![Game_Sort.gif](attachment:6a4f94f6-2368-48e4-a7cb-c786f14e5828:Game_Sort.gif)

![Game_Submit.gif](attachment:86a2b5fc-0e5f-4b06-b9ed-7bad00ada886:Game_Submit.gif)

[Game_Play_3.mp4](attachment:0f58973e-b6d5-4730-b019-bbc88edf305d:Game_Play_3.mp4)

![Game_Guide.gif](attachment:e32d64f0-ff0a-4d25-a218-1a63f2a38bef:Game_Guide.gif)

**✅ 패 정렬, 족보 보기, 모드 변경**

1. 패를 **오름차순**이나 **색상순**으로 정렬하고, **드래그**로 순서 변경 가능
2. **최고 조합** 확인 후 족보를 이용해 전략 세우기
3. 좌측 상단 **유저 배치 순서** 및 하단 **최고 조합 안내 휠 애니메이션** 등의 UI 개선
4. **PASS** 스티커, **현재 진행 유저** 표시, **최근 등록 패** 표시 등의 기능을 통해 UX 개선

---

## [Fun 5] 결과 화면과 랭킹 시스템

---

[Result.mp4](attachment:bdd26d04-eac2-4c4e-9031-58e92a3455b9:Result.mp4)

[Result_3.mp4](attachment:b504ae0f-67eb-43cf-aab2-99edff5780ac:Result_3.mp4)

[Result_2.mp4](attachment:427ceb02-52ae-454b-bb51-d13624b034ab:Result_2.mp4)

### 실시간 결과 확인과 코인 시스템

**✅ 점수 계산 → 코인 수 차이 표시**

1. 각 라운드 후 **결과 화면**에서 유저의 **코인 수**와 **남은 카드 수**를 확인
2. 애니메이션으로 **점수 계산 과정**을 표시하여 초보자 친화적인 설명 제공
3. **Rating 시스템**을 통해 유저의 **게임 결과**가 실시간으로 반영됨
4. **게임 참여 멤버수**에 따른 결과 확인 UI 차이

---
