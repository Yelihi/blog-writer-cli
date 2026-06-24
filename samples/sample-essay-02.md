## 기존 방식의 문제점

기존 popupManager 의 경우 크게 2가지의 문제점을 가지고 있다.

- 함수를 통해 modalManager.dispatch("component name", options) 형식으로 open 할 때, 전달해주는 component name 이
path 로 연결되어 있어서 modal component 가 작성되는 디렉토리가 고정이 된다.
- 전달해주는 props 가 전역 store 를 통해서 관리가 되며, 실제 modal component 내에서는 전역 store 와 명확하게 의존되어있어 테스팅이 쉽지않고,
전달해주는 함수나 특이사항을 가진 modal 의 특정 props 에 대한 타입 추론이 쉽지 않다.
- 중앙 집중형으로 관리가 되다보니, 점점 modal 이 늘어날 수록 비대해지는 경향이 존재한다.
- 만일 modal 위 modal 을 띄어져야 한다면, 현 방식으로는 second-layer 를 생성하여 다시 생성해주어야 한다.

편리함도 존재했고, 그럼에도 이렇게 했었던 이유는
보통 이벤트들을 adapter 계층 내 dispatcher 로 관리하였는데, 현 함수들 내 manager 를 inject 하여서 관리하였기 때문이다.
주입된 경우 mocking 화가 쉬웠고, modal 의 click event 가 다른 modal 의 open 으로 이어질 경우가 많이 있어, Teleport 를 적용하기 쉽지 않았다.

### FSD 내 기존 방식 적용해볼 때 발생 문제

그럼에도 지금까지는 유용하게 활용하였으나,
변경되는 FSD 구조에 한해서는 쉽지가 않아지는데

- 우선 modal 이 생성되는 경로가 획일화 되지 않을 가능성이 높다. 기존처럼 shared/components/modal 이런식으로 한 곳에서 집중 관리하는 형식이 아니라
각 slice 별로 관리될 가능성이 높고, 이렇다면 component name 을 전달하여 path 기반으로 component 를 import 해오는것이 쉽지가 않아진다.
- 구조를 바꾸는 주된 이유 중 하나는, 결국 프론트엔드는 상태를 관리하는것이고, 상태와 관련된 view 의 작업이 대부분이기에 비중 자체가 view 가 커지게 된다.
그렇다면 결국 어떠한 이벤트에 의해 화면에 렌더링 될 컴포넌트를 결정하는 주체 역시 view 에서 이루어지는것이 더 직관적이라 판단하였다.

일단 한번 구현을 진행해보았는데, 역시나 문제는 발생한다.

현재 방식은 중앙 pinia store 내에서 modal 이라는 store 를 생성하여 띄어질 모달의 state 에 대해 관리하고 있다.
open 하는 쪽에서 Component 가 아닌 해당 Component name 을 전달해주고, 이를 CommonModalLayout 내에서 폴더 directory 를 찾아 dynamic import 하는 방식으로 그때그때 호출하는 방식이다.

```tsx
export type ComponentPropsInModal = {
    "confrim-logout": ConfirmLogout;
    "setting-academy-seat": SettingAcademySeat;
    "search-student": SearchStudent;
    "register-new-student": RegisterNewStudent;
    "send-sms": SendSMS;
    "setting-class": SettingClass;
    "attendance-check": AttendanceCheck;
    "detail-today-attendance-student": DetailTodayAttendanceStudent;
    "detail-pending-registration-user": DetailPendingRegistrationUser;
    "setting-curriculum": SettingCurriculum;
    "search-school": SearchSchool;
    "confirm-curriculum": ConfirmCurriculum;
    "add-academy-class": AddAcademyClass;
    "setting-curriculum-list": SettingCurriculumList;
    "challenge-preview-problem": ChallengePreviewProblem;
    "concept-enhancement-student-detail": ConceptEnhancementStudentDetail;

    /** alert */
    "confirm-cancel-provided-challenge": ConfirmCancelProvidedChallenge;
    "delete-challenge-template": DeleteChallengeTemplate;
    "provide-challenge-comment": ProvideChallengeComment;
    "confirm-create-challenge-template": ConfirmCreateChallengeTemplate;
    "challenge-problem-comment": ChallengeProblemComment;
    "preview-challenge-problem-comment": PreviewChallengeProblemComment;
};

/** Layout */

export type ModalLayout =
    | "Alert"
    | "AlertWithSub"
    | "AlertWithClose"
    | "Base"
    | "BaseWithClose"
    | "ModalBaseTitle";

```

각 popup 내 전달될 props 들을 한 곳에서 정리하고, 이를 기반으로 modal 을 호출할 때는,

```tsx
@singleton()
export default class OpenAddClassPopupDispatcher {
    constructor(
        @inject("ModalManager") private readonly modalManager: ClientStateManager.ModalManager,
    ) {}

    public dispatch = () => {
        this.modalManager.dispatch("onmountModal", [
            "add-academy-class",
            {
                title: "반 추가",
                layout: "ModalBaseTitle",
                initialCreateClass: true,
            },
        ]);
    };
}

```

이렇게 해당하는 component 를 찾아, props 와 함께 전달하므로서 관리가 진행되었다.

Layout 에서는 해당 component name 과 실제 layout 을 전달받아 modal 을 open 하게 된다.

```
<script setup lang="ts">
import { defineAsyncComponent, computed, ref, onMounted, onUnmounted } from "vue";
import { container } from "tsyringe";

// 다른 기능 생략

// instance
const modalManager = container.resolve<ClientStateManager.ModalManager>("ModalManager");
const modalState = modalManager.getState();

const component = computed(() => {
    const modalLayoutPath = modalState.modalLayout;
    return defineAsyncComponent(() => import(`./container/${modalLayoutPath}.vue`));
});

</script>

<template>
    <div class="flex items-center justify-center h-auto w-fit z-999" tabindex="-1" ref="dimRef">
        <RootErrorBoundary>
            <Transition name="fade">
                <component :is="component" />
            </Transition>
        </RootErrorBoundary>
    </div>
</template>
}

```

전달된 props의 layoutPath 를 통해 layout 을 import 해오고 적용시킨다.
적용된 해당 Layout 은 각각 설정이 되어있는데, 위 예제는 ModalBaseTitle 이니 해당 Layout 을 살펴보자.

```
<script setup lang="ts">
import { computed, defineAsyncComponent } from "vue";
import { container } from "tsyringe";

// ui
import AlertLayout from "@/ui/shared/layouts/AlertLayout.vue";
import { Close } from "@/ui/shared/components";

// instance
const modalManager = container.resolve<ClientStateManager.ModalManager>("ModalManager");

const component = computed(() => {
    const modalComponentPath = modalManager.getState().modalComponent;
    return defineAsyncComponent(() => import(`../children/${modalComponentPath}/index.vue`));
});

/** Modal창을 닫습니다. */
const closeModal = () => {
    if (modalManager.getState().modalProps?.closeCallback) {
        modalManager.getState().modalProps?.closeCallback();
    }
    modalManager.dispatch("unmountModal");
};
</script>

<template>
    <AlertLayout>
        <div
            class="relative px-[2rem] pb-[2rem] pt-[2.8rem] sm:size-full w-dvw h-dvh sm:max-h-[75rem]"
        >
            <div class="w-full flex flex-col items-start justify-center gap-[1.5rem] mb-[1.6rem]">
                <h2 class="text-lg font-semibold font-pretended text-primary-black">
                    {{ modalManager.getState().modalProps?.title }}
                </h2>
                <div class="w-full h-[0.1rem] bg-custom-border-gray"></div>
            </div>
            <div class="size-full">
                <component :is="component" />
            </div>
            <div
                class="absolute cursor-pointer right-8 top-12 sm:right-1 sm:top-3 size-fit"
                @click="closeModal"
            >
                <Close />
            </div>
        </div>
    </AlertLayout>
</template>

```

결국 둘 다 공통적인 Modal Store 내에서의 State (Props) 기반으로 각각의 내부 component 를 결정하여 import 하는 방식이다.
그리고 이 import 된 component 가 실제 children 으로 들어가게 된다.

이러한 방식이 FSD 내에서 좀 더 복잡해질 수 밖에 없었던 이유는 결국 FSD 는 기능단위 이기 때문이다.

예시로서 logout, login 처럼 auth 와 관련된 기능을 따로 분리하여 관리한다고 가정해보자.

- 기본적은 popup 의 on/off 를 관리하는 것은 shared 내에서 처리되어도 관계는 없다. 혹은 features 내 예외적으로 common 을 두어서 관리해도 괜찮긴 하다.
- 하지만 auth 와 같이 features 와 연관된 popup 의 경우 자연스럽게 auth 내에서 관리가 진행이 되게 되는데, 이렇게 되면 import(`../children/${modalComponentPath}/index.vue`)); 형식으로
관리되는 기존 방식에 불가피한 수정이 필요해진다. 즉, 기존처럼 한 곳에서 관리하는 것이 아니기 때문에 더 어려워진다.
- interface 역시 layer 를 기반으로 좀 더 애매해질 수 있는데, 기존에는 한 곳에서 모든 popup 의 props 를 관리하였지만, 이제 특정 popup 마다 props 를 다른 layer 내에서 관리해야할 가능성이 높다.
위 auth 역시 해당 팝업에 전달될 props 를 해당 layer 에서 관리하게 된다.
- 이렇게 되면 강압적이긴 하나 선언된 interface 를 확장시키는 방향으로 나아가야 하긴 한다.

```tsx

// shared/model/modal/registry.ts
import { BaseModalProps } from "@/shared/models/modal/interface";

/**
 * @description
 * 기본적은 모달들의 타입을 정의합니다. (BaseModalProps)
 * 이는 추후 feature 내에서 각각의 모달에 대한 props 를 상속시킬 예정입니다.
 */
export interface ModalTypeRegistry {
    "confrim-logout": BaseModalProps;
    "setting-academy-seat": BaseModalProps;
    "search-student": BaseModalProps;
    "register-new-student": BaseModalProps;
    "send-sms": BaseModalProps;
    "setting-class": BaseModalProps;
    "attendance-check": BaseModalProps;
    "detail-today-attendance-student": BaseModalProps;
    "detail-pending-registration-user": BaseModalProps;
    "setting-curriculum": BaseModalProps;
    "search-school": BaseModalProps;
    "confirm-curriculum": BaseModalProps;
    "add-academy-class": BaseModalProps;
    "setting-curriculum-list": BaseModalProps;
    "challenge-preview-problem": BaseModalProps;
    "concept-enhancement-student-detail": BaseModalProps;

    /** alert */
    "confirm-cancel-provided-challenge": BaseModalProps;
    "delete-challenge-template": BaseModalProps;
    "provide-challenge-comment": BaseModalProps;
    "confirm-create-challenge-template": BaseModalProps;
    "challenge-problem-comment": BaseModalProps;
    "preview-challenge-problem-comment": BaseModalProps;
}

// features/authentication/model/interface
import type { BaseModalProps } from "@/shared/models/modal/interface";

interface ConfirmLogout extends BaseModalProps {
    confirmFunction: Function;
}

declare module "@/shared/models/modal/registry" {
    interface ModalTypeRegistry {
        "confirm-logout": ConfirmLogout;
    }
}

```

- 지금 예제에서는 confirmFunction 이지만 예전에 튼튼개념의 경우 conceptEnhancementDto 가 필요할 때도 있었고, 이런 경우들이 존재하기에 shared 내에서는 기본적인 props 를 매칭시켜놓고,
이후 각 기능들에서 해당 interface 를 확장하여 사용하는 방법이 존재한다.

개인적으로 위의 방식은 좀 억지스럽다는 느낌이 강했다.
layer 를 지키면서 얻을 수 있는 장점들이 해당 과정에서 오히려 작업 능률을 저하시킬수도 있다는 생각도 들었고, 무엇보다 interface 를 확장한다 하더라도, 해당 확장된 Interface 가 store 내 state 에서 자동 추론이 되지 않는것도 문제였다.
(이 부분은 declare 부분에 대해 좀 더 살펴봐야 할 것 같다.)

결국 위 방식으로 계속 진행하기에는 무리가 있다는 생각이 들었기에, 방식을 변경해보고자 하였다.

## 방식의 변경

PopupManager 에 대해서 어느정도 코드를 작성해주신 분이 계셨는데, 아래 링크가 그러하다.

백발의 개발자 - vue 내에서의 popupManager

다만 작성 코드가 vue2 기반이었고, 아직 코드 분석을 제대로 하지 못해 그대로 활용하기 어려워 우선 vue3 로 변경해보았다.

```tsx
import {
  App,
  Component,
  defineComponent,
  h,
  onBeforeUnmount,
  ref,
  VNode,
} from 'vue'

let nextKey = 0

// 팝업 정보 구조
interface PopupItem {
  component: Component
  params?: Record<string, any>
  key: string
  componentInstance: any
}

// 열려 있는 팝업들을 저장할 리액티브 배열
const popups = ref<PopupItem[]>([])

/**
 * 팝업 열기 함수
 * @param component 팝업으로 표시할 컴포넌트
 * @param params 팝업에 넘길 props
 */
function open(component: Component, params?: Record<string, any>) {
  const key = `_popup_key_${nextKey++}`

  // 새 팝업을 배열에 추가
  popups.value.push({
    component,
    params,
    key,
    componentInstance: null,
  })

  // Vue 2 시절처럼 $forceUpdate를 직접 호출하지 않아도,
  // popups.value 변경으로 인해 PopupAnchor 컴포넌트가 자동 재렌더됩니다.

  // 열 때 반환할 객체
  return {
    popup_key: key,
  }
}

/**
 * 팝업 닫기 함수
 * @param inst 팝업을 가리키는 객체
 *  - 팝업을 열 때 반환된 { popup_key: string } 또는
 *  - 팝업 컴포넌트 인스턴스(this) 자체
 */
function close(inst: any) {
  if (!inst) return

  const idx = popups.value.findIndex((popup) => {
    // 1) 인스턴스로 닫는 경우
    if (inst === popup.componentInstance) {
      return true
    }
    // 2) { popup_key } 객체로 닫는 경우
    if (inst.popup_key === popup.key) {
      return true
    }
    return false
  })

  if (idx !== -1) {
    popups.value.splice(idx, 1)
  }
}

// === PopupAnchor 컴포넌트 (Vue 3 Composition) ===
const PopupAnchor = defineComponent({
  name: 'PopupAnchor',
  setup() {
    // onBeforeUnmount 훅에서 특별히 할 일은 없지만,
    // 만약 anchorVm처럼 전역 참조를 해제해야 한다면 이곳에서 처리
    onBeforeUnmount(() => {
      // anchorVm = null (필요하다면)
    })

    // 렌더 함수
    return () => {
      // popups 배열을 순회하며 h()로 자식 VNode를 만듦
      const children = popups.value.map((popup) =>
        h(popup.component, {
          key: popup.key,
          // Vue 3에서는 props를 객체 형태로 직접 전달 가능
          ...popup.params,
          // VNode 라이프사이클 훅으로 컴포넌트 인스턴스를 저장
          onVnodeMounted: (vnode: VNode) => {
            popup.componentInstance = vnode.component
          },
        })
      )
      return h('div', { class: 'popup-anchor' }, children)
    }
  },
})

// === Plugin: install(app) 함수 ===
const PopupManagerPlugin = {
  install(app: App) {
    // 전역 프로퍼티(= Vue2 시절의 Vue.prototype.$popupManager)를 등록
    app.config.globalProperties.$popupManager = {
      open,
      close,
    }
    // 전역 컴포넌트로 등록
    app.component('PopupAnchor', PopupAnchor)
  },
}

export default PopupManagerPlugin

/**
 * PopupManager를 사용하는 예:
 *
 * import PopupManagerPlugin from './popupManager'
 *
 * const app = createApp(App)
 * app.use(PopupManagerPlugin)
 * app.mount('#app')
 *
 * 그 후, 어떤 컴포넌트에서:
 *
 *  this.$popupManager.open(MyPopupComponent, { title: 'Hello' })
 *
 *  // 팝업 내에서는
 *  this.$popupManager.close(this)  // 본인 인스턴스로 닫기
 *     혹은
 *  this.$popupManager.close(open시 받은 { popup_key })
 */

```

뭔가 복잡해보이니, 한 개 한 개 분석을 해보자.

### PopupItems

정의된 interface 로서 실제 popup 을 open 할 시 전달될 요소들을 정의한 것이다.

```tsx
interface PopupItem {
  component: Component
  params?: Record<string, any>
  key: string
  componentInstance: any
}

// 열려 있는 팝업들을 저장할 리액티브 배열
const popups = ref<PopupItem[]>([])

```

함수 인자에 전달될 요소 중 Component 는 말 그대로 Component 자체를 전달하며 (이는 실제 Modal 이다.) 나머지는 해당 modal 내 option 이라고 볼 수 있다.

여기서 popups 를 통해 배열로서 popup 을 관리할 것인데, 이유는 위에서 언급된 layer 의 z-index 한계 때문이다.
즉, 배열의 순서대로 z-index 를 다루게 두어 여러개의 popup 역시 띄울 수 있도록 처리하겠다는 의미이다.

또 중요한 부분은 componentInstance 에 있는데, 해당 popup 에 대한 instance 정보를 가지고 있겠다는 의미로 보면 된다.

### open

popup 을 open 할 시 사용하는 함수이다.
전달되는 것은 component 와 parmas 이다. 즉, 해당 popup 에 전달될 params 를 같이 인자로 전달하여 component 내 props 로 전달되도록 한다.
여기서 open 의 역할은 다음과 같다.

- 전달된 component 를 popups 내 배열에 push 해준다.
- 반환은 고유한 key 를 반환하도록 한다.

코드를 살펴보자

```tsx
/**
 * 팝업 열기 함수
 * @param component 팝업으로 표시할 컴포넌트
 * @param params 팝업에 넘길 props
 */
function open(component: Component, params?: Record<string, any>) {
. // 고유한 키를 생성해준다.
  const key = `_popup_key_${nextKey++}`

  // 새 팝업을 배열에 추가
  popups.value.push({
    component,
    params,
    key,
    componentInstance: null,
  })

  // Vue 2 시절처럼 $forceUpdate를 직접 호출하지 않아도,
  // popups.value 변경으로 인해 PopupAnchor 컴포넌트가 자동 재렌더됩니다.

  // 열 때 반환할 객체
  return {
    popup_key: key,
  }
}

```

vue 의 반응성을 이용하면 좀 더 편리할 수 있는데, popups 자체가 ref 이기에 변경사항이 발생하면 프록시 set 설정에 의해 자동적으로 렌더링을 유발하도록 PopupAnchor 를 설정할 수 있다.

현 시점에서는 componentInstance 는 null 인데, 렌더링 이후 해당 popup 을 넣어줄 예정이다.

### close

말 그대로 popup을 닫게되는데, 우리는 닫히는 popup 자체를 배열로 관리하고 있기에, 아무 popup 이나 닫아버리면 안된다. 즉, 해당하는 popup 만 close 해야하고 그렇기에 key 값이 필요하다.

```tsx
/**
 * 팝업 닫기 함수
 * @param inst 팝업을 가리키는 객체
 *  - 팝업을 열 때 반환된 { popup_key: string } 또는
 *  - 팝업 컴포넌트 인스턴스(this) 자체
 */
function close(inst: any) {
  if (!inst) return

  const idx = popups.value.findIndex((popup) => {
    // 1) 인스턴스로 닫는 경우
    if (inst === popup.componentInstance) {
      return true
    }
    // 2) { popup_key } 객체로 닫는 경우
    if (inst.popup_key === popup.key) {
      return true
    }
    return false
  })

  if (idx !== -1) {
    popups.value.splice(idx, 1)
  }
}

```

popups 내 저장된 popup 을 삭제하게 된다.

- 저장된 instance 를 기반으로 하게 되면, 해당하는 popup 이 닫히게 된다.
- 만일 외부에서 특정 popup 을 닫는것이라면 popup.key 를 기반으로 처리할 수 있다. (근데 이런 경우는 거진 없다.)
- 한계가 있다면 만일 최 상위 popup 의 닫기를 통해 전체 popup 이 닫혀야 한다면, 이에 대한 추가적인 함수가 필요해보인다.

### PopupAnchor

실제로 popup 을 렌더링 하는 함수이고, 코드를 보면서 하나하나 살펴보기로 한다.

```tsx
// === PopupAnchor 컴포넌트 (Vue 3 Composition) ===
const PopupAnchor = defineComponent({
  name: 'PopupAnchor',
  setup() {
    // onBeforeUnmount 훅에서 특별히 할 일은 없지만,
    // 만약 anchorVm처럼 전역 참조를 해제해야 한다면 이곳에서 처리
    onBeforeUnmount(() => {
      // anchorVm = null (필요하다면)
    })

    // 렌더 함수
    return () => {
      // popups 배열을 순회하며 h()로 자식 VNode를 만듦
      const children = popups.value.map((popup) =>
        h(popup.component, {
          key: popup.key,
          // Vue 3에서는 props를 객체 형태로 직접 전달 가능
          ...popup.params,
          // VNode 라이프사이클 훅으로 컴포넌트 인스턴스를 저장
          onVnodeMounted: (vnode: VNode) => {
            popup.componentInstance = vnode.component
          },
        })
      )
      return h('div', { class: 'popup-anchor' }, children)
    }
  },
})

```

이 popupAnchor 는 실제로 App.vue 내에서 실제 router 되는 component 들과 같은 부모를 지니면서 absolute 형식으로 관리될 것이다.

return 이 중요한데,

- children 은 popups 를 순회하면서 생성이 된다. h() 렌더링 함수를 실제 Element 를 생성하게 되는데, key를 반드시 넘겨주고 props 를 넘겨준다
- key 는 중요한것이, popup 이 하나라도 close 가 되면 해당 순회가 다시 진행되는데, 고유 key 값을 가진 인스턴스가 존재한다면 그냥 리렌더링을 진행하지 않고 지나날 것이기 때문이다.
- onVnodeMounted 는 vue3 내 공식문서에서는 찾아볼 순 없지만, 실제로도 있는 함수이며 좀 더 저수준의 단계라고 볼 수 있겠다.
popup 이 렌더링 된 이후 해당 instance 를 저장해준다.
(이를 기반으로 close 를 할 수도 있고, 특정 작업들을 더 진행할 수도 있다.)
- 이를 기반으로 popupAnchor 컴포넌트를 생성한다.
속성은 div 이며 class 로 popup-anchor 를 가진다 (style 이라고 생각하자). 그리고 children 을 배열로서 가지게 된다.

이러한 렌더링 과정이라면 알 수 있듯이, children 들 조차 absolute 를 통해 layout 이 관리되어야 한다는 점이다.
그렇다면 굳이 popupAnchor 가 스타일 자체를 가질 이유는 없다. children 내에서 알아서 조정되어야 하기에

편의성을 그나마 증가시킨다면, return 되는 children 마다 부모 컴포넌트를 감싸주는 방식도 존재는 한다.

그런데 지금 짜려고 하는 구조의 특성을 살펴보자면, 결국 호출하는 쪽에서 대부분의 UI 를 결정해준다는 것이기에 최대한 엮이지 않도록 설계하는것도
중요하다.

### popupPlugin

사용하기 위해 app 내 plugin 으로 등록해놓으면 편리하다.

```tsx
// === Plugin: install(app) 함수 ===
const PopupManagerPlugin = {
  install(app: App) {
    // 전역 프로퍼티(= Vue2 시절의 Vue.prototype.$popupManager)를 등록
    app.config.globalProperties.$popupManager = {
      open,
      close,
    }
    // 전역 컴포넌트로 등록
    app.component('PopupAnchor', PopupAnchor)
  },
}

```

이제 실제로 사용한다고 한다면

```tsx
/**
 * PopupManager를 사용하는 예:
 *
 * import PopupManagerPlugin from './popupManager'
 *
 * const app = createApp(App)
 * app.use(PopupManagerPlugin)
 * app.mount('#app')
 *
 * 그 후, 어떤 컴포넌트에서:
 *
 *  this.$popupManager.open(MyPopupComponent, { title: 'Hello' })
 *
 *  // 팝업 내에서는
 *  this.$popupManager.close(this)  // 본인 인스턴스로 닫기
 *     혹은
 *  this.$popupManager.close(open시 받은 { popup_key })
 */

```

### 문제가 있다

vue3 의 composition api 내에서는 this 참조가 불가능하다.
그렇기에 팝업 자체를 끄는 경우에 this 를 활용할 수 없고, 이 말은 componentInstance 를 활용할 수 없다는 것과 동일하다.
고민을 해봤을 때, 아무래도 composable 을 통해 popupManager 를 호출하는 방식이 좋아보인다.

```tsx
import { getCurrentInstance } from "vue";

import type { Component } from "vue";
import type { PopupManager } from "@/shared/plugins/PopupManager";

export function usePopupManager() {
    // getCurrentInstance()를 사용하기 위해서는 "setup 컨텍스트" 내에서 이 함수를 호출해야 함
    const instance = getCurrentInstance();
    if (!instance) {
        throw new Error("No current instance found. usePopupManager must be called within setup.");
    }

    const popupManager: PopupManager = instance.appContext.config.globalProperties.$popupManager;

    /**
     * 팝업 열기
     * @param component 팝업 연결 컴포넌트
     * @param params 팝업 연결 컴포넌트에 전달할 파라미터
     * @returns 팝업 키
     */
    const openPopup = (component: Component, params?: Record<string, unknown>): string => {
        return popupManager.openPopup(component, params);
    };

    /**
     * 팝업 닫기
     * @param closeKey 팝업 키
     */
    const closePopup = (closeKey: string) => {
        popupManager.closePopup(closeKey);
    };

    /**
     * @description
     * 팝업 전체 닫기
     */
    const clearPopup = () => {
        popupManager.clearPopup();
    };

    return {
        openPopup,
        closePopup,
        clearPopup,
    };
}

```

위 composable 을 호출하여 popupManager 를 다루는 것이 최선이 아닐까 싶다.

### children 의 변경 시 Transition 적용

작동에 있어 걱정이 되는 부분은 다음과 같다.

- TransitionGroup 의 적용은 보통 순회하는 컴포넌트들에 한하여 사용이 가능하다만, 배열 순회의 변경이 모든 요소에 transition 작용을 진행시킬지가 걱정이다.

만일 그렇지 않다면 코드를 좀 더 수정을 해서 Transition 을 Children에 적용시켜도 될 것으로 파악이 된다.
물론 이렇게 코드를 수정하면 역시나 걱정되는 것은, 이전 팝업이 종료되고 새로운 팝업이 진행되었을 때의 transition 효과가 제대로 작동할지에 대한 의문이다.
(여기서 느낀점은 확실하게도, 이제 더이상 프레임워크의 추상화 함수의 사용만으로는 한계가 드러나고 있다. 이 함수가 어떻게 짜여진 것인지도 파악해야할 때가 오고 있어서 그것은 추후 공부하고자 한다.)

### 일단 실행했는데 생각대로 되지 않는다

코드 자체에는 큰 문제는 없어보인다 생각했는데, 작동하지 않는다.

log 를 통해 살펴보니, 일단 openPopup 이라는 함수에는 반응을 하는것으로 보여진다. openPopup 은 popups 배열의 변화를 유발하고, 이는 ref 의 반응성으로 인해 setup() 내 watch 를 통해 실제 popups 배열이 변경됨을 확인할 수 있었다. 그럼에도 정작 defineComponent 로 정의한 PopupAnchor 의 return 이 제대로 실행되지 않는것 같다고 판단이 되었다.

솔직히 이 부분은 아직도 원인은 모르겠다.
다만 warning 을 참고하여 기존 ref 로 관리되던 popups 를 shallowRef 로 변경하고 (얕은 반응성) 이를 기반으로 아예 새로운 배열을 할당하고, close 할 때는 filter 를 통해 새로운 배열을 할당하는 것으로 코드를 수정하였더니, 이제는 실제로 팝업이 작동하였다.

```tsx
/**
 * @description 전역 popupItems 저장소
 */
const popupItems = shallowRef<PopupItems[]>([]);

/**
 * @description 팝업 리스트에 팝업 추가
 * @param config 팝업 설정 (컴포넌트와 props)
 */
const openPopup = <T extends BasePopupProps>(config: PopupConfig<T>) => {
    // key 를 생성해줍니다.
    const componentKey = `popup-${popupKey.value}`;
    popupKey.value++;

    // 팝업 아이템을 생성합니다.
    const newPopupItems = [
        ...popupItems.value,
        {
            component: config.component,
            props: {
                ...config.props,
                closeKey: componentKey,
            },
            key: componentKey,
            componentInstance: null,
        },
    ];

    popupItems.value = newPopupItems;

    return componentKey;
};

```

차이점이라며 새롭게 popupItems 의 배열을 생성하여 할당해주고 있다는 점에 있다.
(왜 작동하는 것일까..)

### 작성된 PopupManager 를 통해 실제 Popup 을 띄우기 위한 단계

이제 Manager 를 사용하여 실제 Popup을 띄우기까지의 과정을 생각해보자

- 실제 vue 측에서는 popupManager.openPopup을 통해 event 호출로서 팝업을 열게 된다.
- 함수 호출 시 popupsItems 내 전달된 component 가 props 와 함께 하여 객체로서 저장이 된다.
- popupItems 의 변화로서 PopupAnchor 가 반응하여 먼저 PopupLayout 으로 감싸진 (Dim 처리가 되어있고, 이와 관련된 함수가 연결된) 팝업이 렌더링 진행이 된다.
- 인자로 전달된 component 는 PopupLayout 내부로 들어가는데, 그 전에 한번 더 Layout 으로 감싸진다. 이 Layout 은 가장 기본이 되는 흰 바탕의 Card 이다.
그리고 이 Card 내 slot 으로 실제 호출하고자 하는 컴포넌트가 렌더링 된다. (Transition 적용 계층)
- 내부 컴포넌트는 props 가 전달이 되는데, props 는 크게 closeKey 와 rest 로 구별이 된다.
- 구현 컴포넌트는 이러한 props 를 바탕으로 실제 컴포넌트를 구성하게 된다.
- 팝업을 닫게 되면 자연스럽게 popupItems 배열에서 삭제를 진행한다.

각 단계에 대해서 예제 코드를 보면 우선 호출자쪽을 살펴보자

### 호출

```tsx
// test
const { openPopup } = usePopupManager();

const openAlertPopup = () => {
    openPopup<AlertPopupProps>({
        component: AlertLayout,
        props: {
            closeKey: "",
            rest: {
                title: "알림",
                description: "알림 내용",
            },
        },
    });
};

```

어떠한 이벤트에 전달할 open 함수이다. 여기서 나는 usePopupManager 라는 composable 을 통해서 호출하고 있는데, 실제 popupManager 자체를 그대로 import 하는것보다는 더 직관적이기도 하고 재활용성에서 좋다고 판단하여 생성하였다. 특징이 있다면 한 3가지 정도로 볼 수 있겠다.

- AlertPopupProps 처럼 열고자 하는 팝업의 props type 을 지정함으로서, 더 정확하게 props 를 에러없이 전달하도록 한다
- props 내 rest 라고 따로 둔 이유는 실제 렌더함수 h() 에서 props 를 전달할 때, 매 팝업마다 props 가 차이가 날 수 있기에 이를 전달할 때는 ...popupItem.props 로 전달하곤 했는데,
이렇게 하면 실제 RootPopupLayout 과 같은 컴포넌트에서 props 로 전달받는 interface 를 설정하는것이 너무 까다로워진다(아니 거의 불가능)
그래서 rest 라는 특정 key 를 배치하여 전달되는 props 의 타입을 설정해주고, 이를 기반으로 props 를 안정적으로 AlertLayout (여기서는) 에 전달해준다.
- closeKey 의 경우 빈 문자열이지만, 애초에 open 을 하게되면 내부에서 자동적으로 생성을 해주기 때문에 문제는 없다.

팝업을 다시 리펙토링 할 때, 가장 먼저 고려했었던 것은 결국 호출자 쪽 내에서 꽤 많은걸 설정할 수 있도록 하는 것이었다.
그러면서 동시에 열리는 팝업과 호출 관리 매니저 사이 내 공용적으로 사용되는 pinia 의 store 를 삭제하는것도 목표였다.
이전에는 공용적인 pinia store 내에서 모든 팝업에 대해서 관리가 이루어지고 있었다.
store 내 props 가 관리되다 보니, 각 popup component 에 해당 store 에 대한 호출이 강제가 되는 문제도 있었다.
(내 기준에서 가장 깔끔한 컴포넌트는 외부 의존없이 props 로 결정되는 마치 순수함수와 같은 컴포넌트다.)

즉, 기존에는
props 가 아닌 특정 store 를 호출하여
해당 store 내 state 에 접근 후 해당 popup 에 적합한 props 를 가져오도록 설정이 되어있다.
모달 자체는 한 곳에서 관리가 되다 보니, 효율성이 존재하기는 했지만 문제도 있었다.

```
<script setup lang="ts">
// import 생략

// instance
const modalManager = container.resolve<ClientStateManager.ModalManager>("ModalManager");

const { confirmFunction } = modalManager.getState().modalProps as ConfirmCancelProvidedChallenge;

/**
 * @description 돌아가기 버튼 클릭
 */
const clickGoBackButton = () => {
    modalManager.dispatch("unmountModal");
};
</script>

<template>

<!-- ui -->
</template>

<style scoped></style>

```

- 앞에서 언급했듯이 가장 깔끔한 component 는 props 로 순수하게 결정되는 것이고, 모든 popup 이 이러한 부분에서 위배된다는 것은 뼈아프다
- 한 store 내에서 popupOpen, popupProps 등이 state 로 관리가 되어있고, 매 팝업을 오픈할 때 마다 이 상태값이 변경이 되는 형식이기에, popup 위에 popup 을 띄우기 위해서는 새로운 관리 store 가 필요했다.

```tsx
import { defineStore } from "pinia";

import type {
    ComponentPropsInModalSecondLayer,
    ModalSecondLayerState,
    ModalLayout,
    ModalInitialState,
} from "@/adapter/common/stores/client/modal-second-layer/interface";

const useModalSecondLayerStore = defineStore("modalSecondLayerStore", {
    state: (): ModalSecondLayerState<keyof ComponentPropsInModalSecondLayer, ModalLayout> => ({
        modalOpen: false,
        modalComponent: null,
        modalLayout: null,
        modalProps: null,
        modalInitialState: {} as ModalInitialState,
    }),
    actions: {
        onmountModal<T extends keyof ComponentPropsInModalSecondLayer>(
            component: T,
            props: ComponentPropsInModalSecondLayer[T],
        ) {
            this.modalComponent = component;
            this.modalProps = props ? { ...props } : null;
            this.modalLayout = props ? props.layout : null;
            this.modalOpen = true;
        },
        unmountModal() {
            this.modalOpen = false;
            this.modalComponent = null;
            this.modalLayout = null;
            this.modalProps = null;
        },
        setInitialState<T extends keyof ComponentPropsInModalSecondLayer>(
            component: T,
            initialState: ModalInitialState[T],
        ) {
            this.modalInitialState[component] = initialState;
        },
    },
});

export default useModalSecondLayerStore;

```

보통 popup 위의 popup 같은 경우 발생 빈도가 많지는 않지만, 주소 검색 등 상황에 따라서는 발생하는 편이고 어찌되었던 구현을 할 수 있느냐 아니냐는 차이가 있다.
변경된 현 구조는 적어도 열리는 layer 내 지장을 받지는 않는다.

### usePopupManager

매 popupManager 를 컴포넌트마다 의존하는것보다 vue 의 특성상 composable 을 통해 관리되도록 처리하는것이 좋다고 판단하였다.

```tsx
export function usePopupManager() {
    // getCurrentInstance()를 사용하기 위해서는 "setup 컨텍스트" 내에서 이 함수를 호출해야 함
    const instance = getCurrentInstance();
    if (!instance) {
        throw new Error("No current instance found. usePopupManager must be called within setup.");
    }

    const popupManager: PopupManager = instance.appContext.config.globalProperties.$popupManager;

    /**
     * 팝업 열기
     * @param component 팝업 연결 컴포넌트
     * @param params 팝업 연결 컴포넌트에 전달할 파라미터
     * @returns 팝업 키
     */
    const openPopup = <T extends BasePopupProps>(config: PopupConfig<T>): string => {
        return popupManager.openPopup(config);
    };

    /**
     * 팝업 닫기
     * @param closeKey 팝업 키
     */
    const closePopup = (closeKey: string) => {
        popupManager.closePopup(closeKey);
    };

    /**
     * @description
     * 팝업 전체 닫기
     */
    const clearPopup = () => {
        popupManager.clearPopup();
    };

    return {
        openPopup,
        closePopup,
        clearPopup,
    };
}

```

앞서서 popupManager 는 plugin 으로 전역적으로 등록이 되었기 때문에,
현재 가져올 때에도 getCurrentInstance 를 통해 전역 속성에 접근해야 한다. 미리 설정해둔 PopupManager 에 접근한다. (다만 type 지정은 어찌되었던 따로 해주어야 한다. 아니면 any)

이후에 대한 작업은 adapting 을 한번 더 해주었다고 생각하면 된다.
class 형식은 아니라 implements 로 좀 더 엄격하게 타입을 잡아주지는 못한다. 그렇지만 vue global instance 내 접근이 가능해야하기에 composable 로 하였다.

popup을 open 할 때 전달되는 제네릭은 BasePopupProps 를 기반으로 한다.

### PopupProps

앞서서 props 관리를 closeKey, rest 로 관리한다고 하였는데,
사실 이 부분은 좀 더 개발될 필요가 있긴 하다. 약간 불편한것이 존재하기 때문인데, 이렇게 된 이유도 결론적으로 FSD 구조를 따르다 보니 발생했다고 생각하면 된다.

```tsx
/**
 * @description 기본 RestProps
 */
export interface BaseRestProps {
    title?: string;
    subTitle?: string;
    description?: string;
    closeCallback?: Function;
}

/**
 * @description 모든 팝업 레이아웃이 공통적으로 가져야 할 props
 */
export interface BasePopupProps {
    closeKey?: string; // PopupManager에서 자동 생성되므로 optional로 변경
    rest: BaseRestProps;
}

```

기본적으로 모든 popup 내 속하게 될 rest 의 형태는 위와 같다.
Ui 에 따라 해당 props 가 어떤식으로 변경될 지에 대한 것은 결정이 될 것이다.

만일 위 예제처럼 AlertPopupLayout 내 특정 props type 을 지정한다면,

```tsx
/**
 * @description Alert 팝업의 props
 */
export interface AlertPopupProps extends BasePopupProps {}

/**
 * @description 팝업 컴포넌트와 props를 연결하는 타입
 */
export interface PopupConfig<T extends BasePopupProps = BasePopupProps> {
    component: Component;
    props: T;
}

```

BasePopupProps 를 확장시켜서 적용할 수 있게 된다.

기존 목표는 모든 interface 를 해당 파일에서 관리할 까 생각하였고, props 의 대한 정보를 open 하는 쪽에서 제네릭으로 interface 를 넘겨주는 형식이 아니라, 자동 추론되도록 하려고 했으나
호출자 쪽에서 interface 를 결정해주는것은 나쁘지 않다 판단했고,
AlertPopupLayout 처럼 공용적으로 사용될 popup 에 한해서는 shared 내에서 관리가 되겠지만, 그렇지 않은 popup 들도 존재하게 된다.

예를 들어서 (완성된 코드는 아니지만) ConfirmLogoutPopup 을 생각해보자

이 alert 의 기능은 features 내 authentication 내 logout 과 밀접하게 관계가 되어있고, 사실상 features 내 ui 에서 작성될만한 popup 이다.
shared 의 경우 어떠한 layer 도 의존할 수 없기 때문에, ConfirmLogoutPopup 내 전달될 props 를 관리하는 것은 규칙상 옳지 않다 판단되었다.
(물론 할 수는 있다. 특정 도메인에 관련된 props 나 그런것이 없이 BasePopupProps 를 그대로 사용한다고 하면 가능한데, 관리 측면과 의미론적으로서 옳지 않다고 판단했을 뿐이다.)

그렇기에 호출하는 기능 쪽에서 따로 interface 를 지정하여 확장한 다음 적용하는것이 가장 좋다고 판단이 된다.

### 결국 동작은 하는데

실제로 예제 팝업을 만들어 열어보기도 하고 닫아보기도 하면서 테스트를 진행했고, 테스트 상에서는 작동하는것을 확인했다.
다만 내가 하는 프로젝트 특성상 정말 속된 표현으로 ㅈㄹ 같은 팝업이 많기 때문에, 그러한 환경에서도 잘 작동될 수 있을지 체크하는것도 중요 포인트 중 하나가 될 것 같다.

구조를 변경하면서 자연스럽게 기존에 구축해놓았던 환경도 변경이 이루어진다.
그렇기 때문에 이를 변경할 때 마다 main 에 반영하기보단 따로 track 을 두고 가야겠다는 생각이 든다.