# 어니스트 투어 (HFTour)

고객사 관리자 화면에 붙이는 **단계별 사용 안내(투어)** 부품입니다. Ant Design 투어의 화면 구성을 참고해 처음부터 새로 짠 어니스트패밀리 자체 코드입니다. 외부 라이브러리 코드는 들어 있지 않습니다.

- 시연: https://honest-family.github.io/usage-guide-kit/
- 파일: `hf-tour.js` + `hf-tour.css` (의존성 없음, 압축 전송 약 11KB)
- 리액트·넥스트·뷰·넉스트·라라벨 블레이드·일반 HTML 어디든 붙습니다.

## 붙이는 법

```html
<link rel="stylesheet" href="/vendor/hf-tour/hf-tour.css">
<script src="/vendor/hf-tour/hf-tour.js"></script>
<script>
  HFTour.create({
    storageKey: 'product-create-guide-v1',
    launcher: { label: '사용 가이드' },
    beacon: { target: '#category-label', placement: 'right' },
    steps: [
      { target: '#category', title: '카테고리부터 고르세요', description: '고른 카테고리에 맞춰 아래 스펙 칸이 생겨요.' },
      { target: '#price', title: '판매가는 결제 금액이에요', description: '할인 전 가격은 정가 칸에 적어요.' },
      { target: '#submit', title: '등록하면 바로 진열돼요', description: '나중에 언제든 고칠 수 있어요.' }
    ]
  });
</script>
```

리액트·넥스트 (화면에 들어올 때 만들고 나갈 때 치운다):

```jsx
import HFTour from '@/vendor/hf-tour/hf-tour';
import '@/vendor/hf-tour/hf-tour.css';

useEffect(() => {
  const tour = HFTour.create({ storageKey: 'product-create-guide-v1', launcher: true, steps });
  return () => tour.destroy();
}, []);
```

뷰·넉스트:

```js
let tour;
onMounted(() => { tour = HFTour.create({ storageKey: 'product-create-guide-v1', launcher: true, steps }); });
onBeforeUnmount(() => tour && tour.destroy());
```

고객사 색 맞추기:

```css
.hft-root, .hft-launcher, .hft-beacon { --hft-primary: #e8552f; --hft-primary-strong: #cf4320; }
```

## 단계(steps) 항목

| 항목 | 설명 |
|---|---|
| `target` | 가리킬 대상. 선택자 문자열·요소·함수. 없거나 못 찾으면 화면 가운데 창으로 보임 |
| `title` / `description` | 제목 한 줄, 본문 두 줄 이내. `html`을 쓰면 본문에 굵은 글씨 등 가능 |
| `cover` | 첫 장 그림. 이미지 주소나 HTML |
| `placement` | `top`·`bottom`·`left`·`right` (+`-start`·`-end`). 비우면 자동 |
| `interactive` | `true`면 강조된 대상을 눌러 볼 수 있음 |
| `mask`·`type`·`arrow`·`ring`·`gap`·`radius`·`indicator` | 이 단계만 전체 설정과 다르게 할 때 |
| `nextLabel`·`prevLabel` | 이 단계의 단추 문구 |

## 전체 설정

| 설정 | 기본값 | 설명 |
|---|---|---|
| `type` | `'default'` | `'primary'`면 강조색 말풍선 |
| `mask` | `true` | 주변을 어둡게. `false`면 화면을 막지 않음 |
| `maskClosable` | `false` | 어두운 곳을 누르면 닫기 |
| `gap` / `radius` | `6` / `10` | 강조 영역 여백·둥글기 |
| `arrow` / `ring` | `true` / `true` | 꼬리, 강조 테두리 |
| `indicator` | `'dots'` | `'dots'`·`'count'`·`'bar'` 또는 `(현재, 전체) => HTML` |
| `closable` / `keyboard` | `true` / `true` | 닫기 단추, ← → Esc |
| `scrollOffset` | `0` | 화면 위 고정 머리줄 높이(px) |
| `margin` | `12` | 화면 가장자리 여백 |
| `mobileBreakpoint` | `640` | 이 폭 이하면 화면 아래 시트로 바뀜 |
| `waitFor` | `1500` | 대상이 늦게 생길 때 기다리는 시간(ms) |
| `storageKey` | 없음 | 끝내거나 닫으면 기록. 기록이 있으면 점이 사라지고 `'once'` 자동 시작도 안 함 |
| `autoStart` | `false` | `true` 또는 `'once'`. 기본은 사용자가 시작 |
| `launcher` | 없음 | `true` 또는 `{ label, position: 'bottom-right'·'bottom-left' }` 떠 있는 '사용 가이드' 단추 |
| `beacon` | 없음 | `{ target, placement: 'top-right'·'right'·'left', label }` 깜빡이는 점 |
| `labels` | 한국어 | `{ prev, next, finish, ok, close, start }` |
| `zIndex` | `2147480000` | 겹침 순서 |
| `onStart`·`onChange`·`onClose`·`onFinish` | | 단계 이동·종료 때 호출 |

메서드: `start(n)`, `next()`, `prev()`, `goTo(n)`, `close()`, `refresh()`, `reset()`, `isDone()`, `destroy()`
전역: `HFTour.create(설정)`, `HFTour.isDone(키)`, `HFTour.reset(키)`, `HFTour.active()`

## 검수

붙인 화면을 4가지 크기(PC 1440×900·1920×1080, 태블릿 768×1024, 폰 390×844)로 돌려 모든 단계의 설명창 위치를 잽니다.

```
pip install playwright
python tools/check_tour.py https://dev.고객사.kr/admin/products/create "#guide-start"
```

설명창이 화면 밖으로 나감 · 대상이 가려짐 · 설명창이 대상을 덮음 · 꼬리가 엉뚱한 곳을 가리킴 · 강조 테두리가 대상에서 어긋남(1.5px 넘게)을 단계마다 검사하고, 문제가 0건이어야 통과입니다. PC 크기는 윈도우처럼 스크롤바를 보이게 하고 잽니다(스크롤바 폭만큼 어긋나던 문제를 잡기 위해). 로그인이 필요한 화면은 먼저 로그인한 상태를 파일로 저장(Playwright `storage_state`)해 `--storage 상태.json`으로 넘깁니다. `tools/edge-cases.html`은 큰 대상·스크롤 상자·늦게 생기는 대상·없는 대상을 모아 둔 시험 페이지입니다.
