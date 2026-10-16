(function () {
  var cover = '<img src="img/cover-upload.svg" alt="" width="640" height="300">';

  var pageTour = HFTour.create({
    launcher: { label: '사용 가이드' },
    steps: [
      {
        target: '#basic .stage',
        title: '기본 투어부터 눌러 보세요',
        description: 'Ant Design 기본 예제와 같은 3단계 구성이에요. 첫 장에 그림이 들어가요.'
      },
      {
        target: '#admin-help',
        title: '관리자 화면에선 여기서 다시 봐요',
        description: '처음 온 관리자는 깜빡이는 점으로 시작하고, 끝낸 뒤엔 이 단추로 언제든 다시 봐요.'
      },
      {
        target: '#better-list',
        title: '우리가 더한 것',
        description: '폰 시트 전환, 화면 끝 처리, 사용자가 시작하기까지 — 전부 직접 재서 확인했어요.'
      }
    ]
  });
  document.getElementById('hero-start').addEventListener('click', function () { pageTour.start(0); });

  var basicSteps = function (prefix) {
    return [
      {
        target: '#' + prefix + '-upload',
        cover: cover,
        title: '파일은 여기에 올려요',
        description: '사진·엑셀 파일을 끌어다 놓거나 눌러서 고를 수 있어요.'
      },
      {
        target: '#' + prefix + '-save',
        title: '다 고쳤으면 저장',
        description: '저장하기 전까지는 고객 화면에 바뀐 내용이 보이지 않아요.'
      },
      {
        target: '#' + prefix + '-more',
        title: '나머지 기능은 여기에',
        description: '복사·삭제·내려받기는 이 단추를 누르면 나와요.'
      }
    ];
  };

  var basicTour = HFTour.create({ steps: basicSteps('b') });
  document.getElementById('basic-start').addEventListener('click', function () { basicTour.start(0); });

  var nomaskTour = HFTour.create({ steps: basicSteps('n'), type: 'primary', mask: false });
  document.getElementById('nomask-start').addEventListener('click', function () { nomaskTour.start(0); });

  var placeNames = { top: '위', bottom: '아래', left: '왼쪽', right: '오른쪽' };
  Array.prototype.forEach.call(document.querySelectorAll('[data-place]'), function (btn) {
    var side = btn.getAttribute('data-place');
    var tour = HFTour.create({
      steps: [{
        target: '#place-target',
        placement: side,
        title: placeNames[side] + '에 띄웠어요',
        description: '자리가 모자라면 반대편으로 옮기고, 화면 끝에 닿으면 안쪽으로 밀어 넣어요.'
      }]
    });
    btn.addEventListener('click', function () { tour.start(0); });
  });

  var indSteps = [
    { target: '#i-a', title: '상품 목록', description: '등록한 상품을 한눈에 봐요.' },
    { target: '#i-b', title: '주문 관리', description: '새 주문이 오면 여기에 먼저 떠요.' },
    { target: '#i-c', title: '정산', description: '지난달 정산 금액을 확인해요.' }
  ];
  Array.prototype.forEach.call(document.querySelectorAll('[data-ind]'), function (btn) {
    var tour = HFTour.create({ steps: indSteps, indicator: btn.getAttribute('data-ind') });
    btn.addEventListener('click', function () { tour.start(0); });
  });

  var adminTour = HFTour.create({
    storageKey: 'hft-demo-admin-product-v1',
    beacon: { target: '#f-category .field__label', placement: 'right', label: '상품 등록 안내' },
    steps: [
      {
        target: '#f-category',
        title: '카테고리부터 고르세요',
        description: "고른 카테고리에 맞춰 아래 '상품 스펙' 칸이 생겨요."
      },
      {
        target: '#f-price',
        title: '판매가는 결제 금액이에요',
        description: "할인 전 가격은 옆 '정가' 칸에 적으면 줄 그어 보여요."
      },
      {
        target: '#f-submit',
        title: '등록하면 바로 진열돼요',
        description: '누르는 즉시 고객 화면에 보여요. 나중에 언제든 고칠 수 있어요.'
      }
    ]
  });
  document.getElementById('admin-help').addEventListener('click', function () { adminTour.start(0); });
  document.getElementById('admin-reset').addEventListener('click', function () { adminTour.reset(); });

  window.__hftDemo = { pageTour: pageTour, basicTour: basicTour, nomaskTour: nomaskTour, adminTour: adminTour };
})();
