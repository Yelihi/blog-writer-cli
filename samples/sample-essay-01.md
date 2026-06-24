# 많은 length 의 배열을 렌더링 할 때의 성능저하 이슈

1000개가 넘는 배열 내에서 하나의 요소를 수정할 때, 버벅이는 이슈가 생성이 되었다.
원인에 대해서 먼저 파악해 볼 필요는 있지만, 기본적으로 특정 요소가 사라지고 이를 반영하는 배열을 전달할 때 마다 DOM 을 그려주는 과정에서 생기는 버벅임이라 생각이 든다. 즉, 성능의 문제라고 할 수 있겠다.

그렇다면 내가 원하는 것에 대해서 먼저 명확하게 정의할 필요가 있다.

- 특정 요소에 대하여 요소의 데이터 중 일부(예를 들어 isClicked) 가 변경 되었다면 해당 변경된 엘리먼트만 다시 렌더링 되도록 설정
- 특정 요소를 삭제한다면, 나머지 요소는 그대로 두고 삭제되는 요소만 DOM 에서 지우고 싶음
- 실제로 렌더링 최적화가 되는지 테스트해보고 싶음

실제로 performance 탭 내에서 성능을 체크해 봤을 때 발견되는 현상이 있다. 우선 분석 결과를 확인해보자.

!스크린샷 2025-10-10 오후 4.02.14.png

!스크린샷 2025-10-10 오후 4.02.54.png

!스크린샷 2025-10-10 오후 4.03.08.png

---

The call tree you provided shows a click event triggering a series of Vue component updates, ultimately taking 430ms. The majority of this time (385.5ms) is spent within deeply nested `patch` and component update functions, specifically related to the `BaseTable` component. Let's break down the key areas for improvement:

### Key Bottlenecks

- **Repeated Component Updates:** The trace shows multiple, nested calls to `instance.update`, `componentUpdateFn`, and `patch` within the `BaseTable` component (URL #1). This suggests that updates are being triggered unnecessarily or inefficiently, potentially due to changes in props or data that don't actually require re-rendering the entire component or its children.
- **`renderList` and List Rendering:** Within the component update cycle, `renderList` (URL #0) takes a significant 311ms. This function is responsible for rendering lists of items within the `BaseTable`. The time spent here indicates a potential bottleneck in how the table data is being rendered or updated. The anonymous function within `renderList` (URL #1) takes 308.6ms itself, suggesting the main list rendering logic within the component is slow.
- **`patchKeyedChildren`:** Several calls to `patchKeyedChildren` (within `BaseTable`) take considerable time (74.2ms, 69.7ms, 26ms). This function handles updates to lists of elements with keys, and its duration suggests potential inefficiencies in how the table rows or cells are being updated when data changes.

### Suggestions for Improvement

- **Optimize Component Updates in `BaseTable`:**
    - **Identify Unnecessary Updates:** Use Vue Devtools or console logging to track when and why the `BaseTable` and its child components are re-rendering. Are props changing frequently? Are computed properties being re-evaluated unnecessarily?
    - **`shouldComponentUpdate` (or `memo` in Vue 3):** If you can identify cases where updates are triggered with the same props/data, implement `shouldComponentUpdate` (for class components) or wrap functional components with `memo` to prevent unnecessary re-renders.
    - **Prop/Data Granularity:** If possible, avoid passing large, complex objects as props. Instead, pass only the specific data that each child component needs. This can help isolate updates and prevent cascading re-renders.
    - **Consider `v-memo`:** For parts of the template that don't change frequently based on props or state, use `v-memo` to cache the rendered output and skip updates.
- **Improve List Rendering Performance:**
    - **Virtualization:** For large tables, implement a virtualization library (e.g., `vue-virtual-scroller`) to render only the visible rows. This drastically reduces the number of elements being rendered and updated at any given time.
    - **Efficient Data Updates:** When updating table data, try to modify only the specific rows or cells that have changed instead of re-rendering the entire table. For example, if a single row is updated, find a way to update just that row's data in the table's state and trigger a minimal update to the component.
    - **Key Optimization:** Ensure that the keys used in `v-for` for table rows are stable and uniquely identify each row, even when the data changes. This helps Vue's diffing algorithm efficiently identify and update only the necessary elements.
- **Optimize `patchKeyedChildren`:**
    - **Key Stability:** As mentioned above, verify that keys are stable and accurate. Incorrect or unstable keys can lead to inefficient updates where elements are unnecessarily re-created instead of updated in place.
    - **Targeted Updates:** If possible, try to provide more specific information about changes to the list so that `patchKeyedChildren` can perform more targeted updates. For instance, if you know that only a few items have been added or removed, providing that information might help Vue optimize the update process.
    - **Consider Simpler Structures:** Examine the template structure within the table. Are there deeply nested or overly complex elements within each row or cell? Simplifying the structure, if feasible, can improve the efficiency of `patchKeyedChildren`.
- **General Vue Optimization Techniques:**
    - **Computed Property Caching:** Ensure computed properties are used effectively and only re-compute when their dependencies change. Avoid unnecessary dependencies in computed properties.
    - **Watchers:** Review any watchers in the `BaseTable` component. Are they triggering updates too frequently? Can they be optimized to react only to meaningful changes?
    - **Event Handling:** Are event handlers attached to every row or cell? Consider using event delegation (attaching a single handler to the table container) to reduce the number of event listeners.

By systematically addressing these potential bottlenecks, starting with the component update cycle and list rendering within `BaseTable`, you should be able to significantly reduce the execution time of the click event handler. Remember to profile your changes after each optimization to measure the impact and identify any new bottlenecks that may arise.

---

분명한 사실은 BaseTable 의 렌더링 과정에서 발생하고 있고, 검토해볼 사항은 다음과 같다 판단된다.

- 어떠한 마우스 이벤트가 발생했을 때, 이때에 대한 renderList 구성 과정에서 내가 고칠수 있는것은 isFindSelectedTarget 함수 일 것 같다.
- Table 에 전달되는 key 값이 정확하게 유니크한 id 로 전달되는지 확인이 필요하다.

# isFindSelectedTarget

이 함수는 BaseTable 내에서 작동하는 함수로서, 만일 Table 내 체크박스 옵션을 추가하였을경우, 이에 대한 동작을 하기위한 함수이다.

```tsx

export default class TableModel {
    protected props: BaseTable;
    constructor(props: BaseTable) {
        this.props = props;
    }

	// ... 생략

    /** @description 체크된 row 내 id 를 전달하고자 확인합니다. */
    public isFindSelectedTarget(source: DataSource) {
        const findSelectedTarget = this.props.selectedRows?.find(
            (selected) => selected.id === source.id,
        );

        return findSelectedTarget !== undefined;
    }
}

```

전달받은 props 의 selectedRow (실제로 전체 데이터 내에서 체크가 된 배열) 을 기반으로, 현재 id 가 selected id 인지 판별하게 됩니다. (return 은 boolean)

그리고 이 함수가 호출되는 상황을 살펴보면,

```html
                             <tr
                                    v-for="(source, index) in dataSource"
                                    key="source.id"
                                >
                                    <td
                                        v-if="isSelectOption"
                                        key="selection-column"
                                    >
                                        <BaseCheckbox
                                            type="single"
                                            :value="source"
                                            :model-value="computedSelectedRows"
                                            :reference-values="dataSource"
                                            :checked="model.isFindSelectedTarget(source)"
                                            @emit-model-value="checkOption"
                                        />
                                    </td>

```

체크박스를 클릭할 때, checkOption 을 통해 현 id 를 상위로 emit 한 뒤, 상위에서는 selectedRow 를 업데이트 하게 되면서 자연스럽게 props 가 업데이트가 된다.
업데이트 된 selectedRow 를 기반으로 해당 checkbox 는 isFindSelectedTarget 을 실행하게 된다.

함수의 실행 주체가 체크박스 개별이라는 것에 주목해보자.
문제가 되었던것은 selectedRow 의 배열길이가 증가될 수록 (실제로 선택된 문항을 점점 더 해제할 수록 속도가 증가) 버벅이는 현상이 증가했던 것이며, 어떤 배열의 증가로 속도가 저하된다는 것은 크게 2가지로 상황을 살펴볼 수 있겠다.

- 배열 자체가 길어져서 이에 대한 렌더링 작업(paint) 의 증가
- 어떠한 이벤트가 배열 내 모든 원소 하나하나마다 실행이 됨 -> 이 실행이 마무리 될 때까지 병목 현상 발생 -> 다음 UI render 지체

위 performance 분석을 살펴볼 때, 분명 한번의 click event 가 발생하였는데, 함수 실행 횟수가 너무 많았다.
즉, 한번의 props.selectedRow 의 변화로서 다시한번 렌더링이 진행이 되고, BaseTable 내 BaseCheckbox 의 실행함수인 isFindSelectedTarget 이 다시 실행되는데
그 횟수가 dataSource 의 길이만큼 실행이 될 것이다.

다시 isFindSelectedTarget 함수를 살펴보면

```tsx
    /** @description 체크된 row 내 id 를 전달하고자 확인합니다. */
    public isFindSelectedTarget(source: DataSource) {
        const findSelectedTarget = this.props.selectedRows?.find(
            (selected) => selected.id === source.id,
        );

        return findSelectedTarget !== undefined;
    }

```

이 함수는 실행 될 때, props 로 전달된 selectedRows 를 한번 순회 (n) 하게 된다.
만약에 100개의 table row 가 존재한다면, 이 중 1개를 삭제한다고 했을 때, 99번의 isFindSelectedTarget 이 실행이 될 것이며,
이 함수는 99 length 의 배열을 순회하게 되니, 최악의 경우가 n * n 이 될 것이다.

사실 100개의 배열이던 300개의 배열이던 그렇게까지 로직의 실행 속도에 영향은 끼치지 않을것 같지만, 이후 순서가 layout, paint 이기에 실제 브라우저에 주는 부담감은 상당한 듯 하다.

일단 이 부분부터 해결해보자.
현재 Table 내 사용하는 Checkbox 컴포넌트의 로직 구현상 어쩔수 없이 props 로 selectedArray 를 전달해주어야 한다.
가장 먼저 해볼 수 있는 방안은 시간복잡도를 낮추는 것이다. 함수의 실행 횟수는 그대로라고 가정하고, 대신 함수가 실행될 때의 소요되는 시간을  O(1)으로 낮춰보자.

```tsx

	constructor(
		this.selectedRowSet = new Set(props.dataSource.map((row) => row.id) || []);
	){}

    /** @description 체크된 row 내 id 를 전달하고자 확인합니다. */
    public isFindSelectedTarget(source: DataSource) {
        return this.selectedRowSet.has(source.id);
    }

	public updateSelectedRowSet(selectedRow: DataSource[] | undefined) {
		this.selectedRowSet = new Set(selectedRow?.map((row) => row.id) || [])
	}

```

기존 isFindSelectedTarget 의 시간복잡도를 O(n) 에서 O(1) 로 변경하였고, 이는 n이 얼만큼 커지더라도 함수 실행의 속도 자체는 동일하게 해두었다.
물론 메모리를 더 써야한다는 단점이 있지만, 그리고 어찌되었던 전체 dataSource 의 n 만큼 함수가 실행된다는 단점은 있겠지만, 그럼에도 성능은 어느정도 개선이 되었다고 판단이 된다.

!스크린샷 2025-10-10 오후 4.03.37.png

상황에 따라 차이가 있겠지만, 비슷한 조건 내에서의 task 실행 시간이 400ms 에서 110 ms 로 감소하였다. 이러한 시간은 n 이 커질수록 더 드라마틱 해질 것이라 판단이 된다. 그리고 실제로 빌드 후 테스트를 했을 때에도 눈에 띌 정도로 사용성이 개선되었다는 것을 확인하였다.

다만 코드를 이렇게 수행함으로서 아직까지 남아있는 문제가 있다면 다음과 같았다.

- 무의미할 정도로 실행 속도가 감소했지만, 과연 반드시 selected 여부 판단을 매 row 가 함수를 실행해서 판단해야하는것인가?
- 특정 문항을 체크 했을 때 배경색까지 핑크색으로 되어야 하는데, 현 변경된 코드는 computed 로 감싸진 customClass 내에서 즉각적인 반응이 이루어지지 않는다.

일단은 개선이 되었으니, 다음 배경색 변경 스타일까지 개선이 기획의도에 맞기에 이 부분부터 먼저 고쳐보자
원인은 간단하다. computed 로 감지하고 있는 것은 table 내 전달되고 있는 props 이며 그 중, props.selectedRows 의 변화를 감지하여 매번 isFindeSelectedTarget 을 실행하고 있었다.
지금은 새롭게 set 을 생성하고 updateSelectedRowsSet 를 호출하고 있기에, 그리고 이러한 함수 호출은 renderList() 내에서 일어나고 있진 않고, 한번 실행되고 있다.
(당연하게도 updateSelectedRowsSet 의 실행 시점은 props.selectedRows 의 변동이 일어난 딱 한번이다.)

수정을 한다면 순서가 보장되어야 한다.

- 즉, updateSelectedRowsSet 이 먼저 발생하고, 이후에 각 row 에 대한 순회를 돌면서 isFindSelectedTarget 이 실행되어야 한다.

하지만 vue 내에서 watch 의 순서를 보장한다는것은 쉽지 않고, 오히려 억지스러울 수 있다. 그렇기에 해결 방안을 다른 식으로 바꿔야 할 수 있다.

나중에는 BaseTable 전체에 대한 리펙토링이 있어야 할 것 같지만, 우선 현 상황에 대해서 한번 더 수정을 가한다 하면, 현재 style 적용 코드는 다음과 같은데,

```
<tr
	v-for="(source, index) in dataSource"
	:key="source.id"
	:style="{ height: trHeight + 'rem' }"
	class="w-full cursor-pointer hover:bg-custom-background-gray"
	:class="customBodyTrClass(source)"
	@click="emitTableRowClick(source)"
>

```

table 내 tr 이 반복 render 되면서 (renderList) 매번 custombodyTrClass 함수가 실행이 된다. 이 함수는 style 에 대한 객체를 생성하는데,

```tsx
/** body의 tr tableScroll 설정 */
const customBodyTrClass = computed(() => {
    return (source: DataSource) => {
        const checkStyle = {
            "bg-secondary-red":
                (model.isFindSelectedTarget(source) && !source.isClicked) ||
                (source.isClicked && props.rowColorWhenClick === "red"),
            "bg-white": !model.isFindSelectedTarget(source) && !source.isClicked,
            "bg-secondary-yellow": source.isClicked && props.rowColorWhenClick === "yellow",
        };

        const bodyScrollStyle = {
            "table table-fixed": props.isBodyScroll,
        };

        const bottomBorder = {
            "border-b border-custom-border-gray": props.isTrBottomBorder,
        };

        return {
            ...checkStyle,
            ...bodyScrollStyle,
            ...bottomBorder,
        };
    };
});

```

checkStyle 내에서 model.isFindSelectedTarget 을 호출하게 된다.

의도는 간단하다. 체크가 되어있는가 되어있지 않은가를 통해 색상을 결정하려고 한다. 그렇다면 이렇게도 생각할 수 있겠다.

- 중요한 것은 현재 tr 내 전달되는 id 값이 selected 되어있는지 여부를 판단하고, 판단이 끝나면 그냥 배경색을 적용시키면 되는것 아닌가.
- selected 부분은 props 로 전달되는 selectedRows 의 배열이며 해당 배열 내 속하는지를 판단하는것이 필요해보인다.

결국 하고 싶은것은 변경되는 엘리먼트만 다시 렌더링 시키고 싶은 것이고, 현재는 computed 된 객체를 전달하고 있기 때문에 vue 에서는 이를 props 의 변화로 감지할 것이다.

아래는 공식 문서에서의 props 에 대한 설명이다.

!스크린샷 2025-10-10 오후 4.04.02.png

props 의 변화는 곧 렌더링이다.
불필요하게 렌더링을 유발할 필요가 없으니, 이에 대한 수정이 필요하다. 다만, 대규모의 수정이 예상된다.

우선 table 을 이루는 여러 element 들을 각각의 컴포넌트로 분리하겠다. (추후 테스트를 해보면 성능이 드라마틱하게 좋아지지 않는 경우도 있는데, 이는 나중에 설명하겠다.)

```
<script setup lang="ts">
import { useAttrs } from "vue";

defineProps<{
    id?: string | number;
    clicked?: boolean;
    checkSelected?: boolean;
    colorWhenClicked?: string;
    addBodyScroll?: boolean;
    bottomBorder?: boolean;
    customClass?: string | string[];
    customStyle?: Record<string, string>;
}>();

const attrs = useAttrs();
</script>

<template>
    <tr
        v-bind="attrs"
        :style="customStyle"
        class="w-full cursor-pointer hover:bg-custom-background-gray"
        :class="{
            customClass,
            'bg-secondary-red':
                (checkSelected && !clicked) || (clicked && colorWhenClicked === 'red'),
            'bg-white': !checkSelected && !clicked,
            'bg-secondary-yellow': clicked && colorWhenClicked === 'yellow',
            'table table-fixed': addBodyScroll,
            'border-b border-custom-border-gray': bottomBorder,
        }"
    >
        <slot />
    </tr>
</template>

<style scoped></style>

```

실제 HTML element 를 컴포넌트화 한것이니, useAttrs 를 통해 해당 element 내에서 사용가능한 api 를 열어두도록 한다.
이후, 기존에 customClass 로 computed 된 객체를 한번에 넘겨주는것이 아니라, 각각의 조건들에 대한 boolean 값들을 props 로 하나하나 분리해준다.

template 내에서 class내 객체로 tailwind 의 class 를 넘겨주고 있는데, 어찌보면 이 역시 객체를 넘겨주는 것이라 생각할 순 있다.
그럼에도 vue3 에서는 해당 조건에 해당하는 tailwind의 class 를 인지하고 이를 string 으로 연결시켜준다. 렌더링 최적화를 도와준다고 할 수 있겠다.

vue 에서 중요한것은 결과값이다!
전달되거나 반환하는 값이 원시값이라면 그 값을 확실하게 bind 하고, 해당 원시값이 변경된다면 그 때 다시 렌더링을 진행할 것이다.
이는 computed 로 전달되는 객체값과는 차이가 있다고 판단된다. (약간 아리까리하긴 하다. 뭔가 vue 의 최적화라면 computed 로 전달된 객체도 최적화를 시켜버릴것 같긴 한데... 그냥 확실하게 하자)

다시 Table 로 돌아와 추가한 TableRow 컴포넌트를 적용시켜준다.

```
 <TableRow
	v-for="(source, index) in dataSource"
	class="w-full cursor-pointer hover:bg-custom-background-gray"
	:key="source.id"
	:style="{ height: trHeight + 'rem' }"
	:clicked="source.isClicked"
	:check-selected="isSelected(source.id)"
	:add-body-scroll="isBodyScroll"
	:color-when-clicked="rowColorWhenClick"
	:bottom-border="isTrBottomBorder"
	@click="emitTableRowClick(source)"
	>

```

각각의 조건값들을 직접적으로 전달하여 만일 해당 Row 내 변경이 생기면 변경이 생성된 Row 만 렌더링을 진행할 것이다.

최적화를 하는것도 중요한데, 우선 해결하고자 했던 것이 배경색 이슈였으니 같이 연동해서 더 해결해보자

```tsx
export default class TableModel {
    protected props: BaseTable;
    private selectedRowSet: Set<string | number>;
    constructor(props: BaseTable) {
        this.props = props;
        this.selectedRowSet = new Set(props.selectedRows?.map((row) => row.id) || []);
    }

    /** @description 모든 row 가 체크되었는지를 확인 */
    public isAllSelected(selectedLength: number, dataSourceLength: number) {
        return dataSourceLength > 0 && selectedLength === dataSourceLength;
    }

    /** @description 체크된 row 내 id 를 전달하고자 확인합니다. */
    public isFindSelectedTarget(source: DataSource) {
        return this.selectedRowSet.has(source.id);
    }

    /** @description selectedRows가 변경될 때 호출되어야 합니다 */
    public updateSelectedRowsSet(selectedRows: DataSource[] | undefined) {
        this.selectedRowSet = new Set(selectedRows?.map((row) => row.id) || []);
    }
}

```

문제점은 다음과 같다

- 기존과 달리 props.selectedRow 를 그대로 활용하는 것이 아니라 새롭게 set 을 만들어서 활용한다. (시간복잡도를 위해)
- 만일 props.selectedRow 가 변경되면 watch 를 통해 updateSelectedRowsSet 을 실행시킨다.
- 하지만 그 시점이 computed 로 전달되어 각 row 마다 실행되는 isFindSelectedTarget 의 실행 시점보다 먼저 실행되지 않는다.
- 따라서 배경색을 결정하는 isFindeSelectedTarget 의 기준 set 은 기존의 selectedRow 라고 할 수 있다. 그렇기에 새롭게 체크된 사항에 대해서는 배경색이 그대로다.

!스크린샷 2025-10-10 오후 4.04.39.png

call tree 에서 확인할 수 있듯이, 이벤트 발생 후 isFindSelectedTarget 실행과 updateSelectedRowSet 의 실행 시점의 명확한 순서를 알 수는 없다.
결과로 판단한다면 isFindSelectedTarget 이 먼저 실행되었다고 할 수 있겠다.

이를 해결하기 위해서라면 결국 props.selectedRow 가 변경되는 시점 내 이를 catch 하고, 이를 기반으로 체크여부를 판단하는 함수로 체크여부를 판단해야한다.

```tsx

const computedSelectedRows = computed(() => {
	return new Set(props.selectedRows.map((row) => row.id) || [])
})

const findSelected = (source: DataSource) => {
	return computedSelectedRows.value.has(source.id);
}

```

Table 컴포넌트 내 template 에서 직접 구현한 함수를 기반으로 isFindSelectedTarget 을 대체한다.
그리고 model 내 내부 정의된 set 을 삭제한다. 굳이 updateSelectedRowsSet 을 구현할 필요도 없어졌다.

실제로 동작해보니 이제는 배경색도 잘 변경됨을 확인할 수 있었다.

# 생각대로 돌아가진 않는다

배경색 이슈도 해결했고, 분명히 성능 개선도 되었으니 이제 다시한번 성능 체크를 진행해보았다.

잉? 이상하다.

어째서 하나의 task 에서 220ms 정도의 속도가 나오는것이지? 기존 110ms 정도에서 오히려 더 성능이 안좋아졌다.

변경사항들을 하나하나 생각해보았다.

- 기존 element 로 관리되는 table 내 요소를 각각의 컴포넌트로 분리하였다.
- 배경색 요소 변경을 반영하기 위해 props 에 변화에 따른 findSelected 를 적용하였다.

findSelected 는 문제가 없어보인다. 그렇다면 각각으로 나눠진 element 가 원인이라고 할 수 있을 텐데, 그 차이가 이정도로 render 효율을 감소시키는것일까?

- 실제 html 내 element 와 sfc 기준 component 의 렌더비용은 차이가 있음
- component 라면 instance 가 생성되는 것이고, 이 instance는 생명주기, 반응형 시스템들이 적용이 된다.
- 어찌되었던 부모와 자식관계로서 부모의 props 가 변경된다면 자식까지도 이어지는 편
- 결론적으로 Vue는 HTML 요소에 직접적으로 bind 되었을 때가 가장 효과적으로 작동된다. 컴포넌트 중첩이 많을 수록 효율이 떨어진다.

위 내용은 cursor 에서 알려준 내용이고, 추가 검증이 필요할 것으로 판단된다. 다만 performance 창을 봤을 때에도 분명히 *sfc_render* 과정이 증가되었음을 알 수 있었다.
컴포넌트에 대한 분할은 그에 대한 비용도 추가됨을 알 수 있었다.

> 그렇다면 앞서 성능이 개선되었던 것은, props 로 전달되었던 computed 내 isFindSelectedRow 함수가 전체 row 에서 실행되더라도 O(1) 의 효율을 가지기에
딱히 문제가 되지 않았으며, 추가적인 컴포넌트 충첩이 없는 상태였기에 성능이 더 좋게 나온것 아닐까?
> 

지금으로서는 이렇게 판단할 수 있을 것 같다.

하지만 현재로서는 지금 구조를 유지하고 싶은 마음이 있다.
요소별로 컴포넌트로 분리하였을 때, 각 요소마다 뭔가 특정적인 condition 을 가지게 할 수 있고, slot 에 대한 조건 역시 생성할 수 있다.
추후 관리라는 측면에서 분리된 컴포넌트를 유지하는것은 도움이 될 것이라 판단이 되기 때문이다.

그렇다고 지금의 성능 저하를 그대로 보고있을 순 없다.
개선을 해야하는데, 개선할 요소가 또 있지 않을까 찾아보게 되었다.

!스크린샷 2025-10-10 오후 4.05.01.png

위 render 부분에서 유독 오래걸리는 render 가 존재한다. BaseCheckbox!

check 여부에 따라 on/off 되는 컴포넌트인데, 변경된 컴포넌트만 변하면 될 텐데, 이렇게까지 오래 걸릴것이 아닌데라는 생각이 들었다.
코드를 살펴보니 한번의 변화(체크 toggle)로서 전체 checkbox 가 실행됨을 알 수 있었다.

```
<script setup lang="ts" generic="T">

// 생략

const props = defineProps<BaseCheckboxProps<T>>();
const emits = defineEmits<BaseCheckboxEmits<T>>();
const model = new BaseCheckboxModel(props);

/** bold 설정에 따라 렌더링하는 컴포넌트를 변경합니다. */
const unCheckedComponent = computed(() => {
    return props.isBold ? UnCheckedBoldIcon : UnCheckedIcon;
});

/** bold 설정에 따라 렌더링하는 컴포넌트를 변경합니다. */
const checkedComponent = computed(() => {
    return props.isBold ? CheckedBoldIcon : CheckedIcon;
});

const checked = computed(() => {
    return props.type === "all"
        ? props.modelValue.length === props.referenceValues.length &&
              props.referenceValues.length > 0
        : props.modelValue.includes(props.value);
});

// 체크를 하지 않은 상태 내 전체 타입의 경우 컴포넌트 형태를 분기처리합니다.
// 만일 일부만 체크가 되어있다면 SomeCheckBoxIcon 컴포넌트를 렌더링합니다.
const allTypeUnCheckedComponent = computed(() => {
    return props.modelValue.length > 0 ? SomeCheckBoxIcon : UnCheckedIcon;
});

const handleChange = () => {
    switch (props.type) {
        case "all":
            emits("emit-model-value", model.checkAllValue(checked.value));
            return;
        case "single":
            emits("emit-model-value", model.checkValue(checked.value));
            return;
    }
};
</script>

<template>
    <div class="relative flex items-center size-fit">
        <input
            type="checkbox"
            :checked="checked"
            :value="value"
            @change="handleChange"
            class="absolute h-[2rem] opacity-0 w-[2rem] cursor-pointer"
        />
        <div
            v-if="type === 'single'"
            class="flex items-center justify-center flex-shrink-0 bg-white"
        >
            <component :is="checked ? checkedComponent : unCheckedComponent" />
        </div>
        <div v-else class="flex items-center justify-center flex-shrink-0 bg-white">
            <component :is="checked ? checkedComponent : allTypeUnCheckedComponent" />
        </div>
    </div>
</template>

<style scoped></style>

```

위 코드는 BaseCheckbox 이며, props 로 전달받는 것은 modelValue 배열과 referenceValue 배열이다.

이제 어떤말을 하려는지 아실것이라 생각이 든다. 전달받는 props 는 객체로서 매번 컴포넌트 내에서는 새로운 변화로 받아들일 것이다. 또한 체크를 통해 실제로 modelValue 배열값이 변경된다면 이는 모든 checkbox 의 렌더링으로 이어지게 된다. (referenceValue 역시 마찬가지)

또한 내부 로직을 살펴보면

```tsx
export interface BaseCheckboxProps<T> {
    type: "all" | "single";
    value: T;
    modelValue: T[];
    referenceValues: T[];
    isBold: boolean;
}

export interface BaseCheckboxEmits<T> {
    (event: "emit-model-value", value: T[]): void;
}

export default class BaseCheckboxModel<T> {
    private _props: BaseCheckboxProps<T>;

    constructor(props: BaseCheckboxProps<T>) {
        this._props = props;
    }

    /** 전체 선택 */
    checkAllValue = (isChecked: boolean) => {
        let newModelValue = [...this._props.modelValue];
        if (isChecked) {
            newModelValue = [];
        } else {
            newModelValue = this._props.referenceValues;
        }
        return newModelValue;
    };

    /** 개별 선택 */
    checkValue = (isChecked: boolean) => {
        let newModelValue = [...this._props.modelValue];
        if (isChecked) {
            newModelValue = newModelValue.filter((value) => value !== this._props.value);
        } else {
            newModelValue.push(this._props.value);
        }
        return newModelValue;
    };
}

```

내부 로직에서는 역시나 시간복잡도 내에서 불리한 산수를 진행중이다. 전체 선택정도는 괜찮지만, 개별 선택 시 항상 filter 를 진행한다.

성능 최적화를 위해 2가지 작업을 진행해보자

- props 로 전달되는 사항은 해당 체크박스가 클릭되었다는 부분이 중요하기에 이를 원시값으로 전달하도록 한다
- 내부에 정의되어있는 함수들을 모두 상위 컴포넌트 내에서 처리하도록 한다. (즉, 개별적인 checkbox 컴포넌트 내 model 을 삭제)

진행하려고 하니 문제가 되는것은, 어찌되었던 checkbox 를 재대로 구현하려면 위 model 내 함수들의 역할이 필요했다.
즉, 위의 로직들이 항상 필요하기에 매번 checkbox 를 사용하는 부모 컴포넌트에서 위 로직을 반복해서 구현하는것은 말이 되지 않았고,
고민끝에 composable 로 공용 로직을 생성하기로 했다.
(확실히 이 부분은 매 checkbox 를 사용하는 컴포넌트 내에서 composable 을 모두 호출해야하기에 기분이 좋진 않다..)

```tsx
import { ref, computed } from "vue";

function useCheckbox<T extends { id: string | number }>(initialItems: T[] = []) {
    // ID만 저장하는 Set 사용
    const selectedIds = ref<Set<string | number>>(new Set(initialItems.map((item) => item.id)));

    const selectedIdsArray = computed(() => [...selectedIds.value]);

    // 항목 선택 여부 확인 (O(1) 시간 복잡도)
    const isSelected = (id: string | number): boolean => {
        return selectedIds.value.has(id);
    };

    // 모든 항목이 선택됐는지 확인
    const isAllSelected = (allItems: T[]): boolean => {
        if (allItems.length === 0) return false;
        return allItems.every((item) => selectedIds.value.has(item.id));
    };

    // 일부만 선택됐는지 확인
    const isSomeSelected = (allItems: T[]): boolean => {
        return allItems.some((item) => selectedIds.value.has(item.id)) && !isAllSelected(allItems);
    };

    // 단일 항목 선택/해제
    const toggleSelection = (id: string | number): void => {
        if (selectedIds.value.has(id)) {
            selectedIds.value.delete(id);
        } else {
            selectedIds.value.add(id);
        }
    };

    // 전체 선택/해제
    const toggleAll = (allItems: T[]): void => {
        if (isAllSelected(allItems)) {
            // 모두 해제
            selectedIds.value.clear();
        } else {
            // 모두 선택
            for (const item of allItems) {
                selectedIds.value.add(item.id);
            }
        }
    };

    // 선택 상태 업데이트 (외부에서 강제 설정 시)
    const updateSelection = (selectedRows: T[]): void => {
        selectedIds.value.clear();
        for (const selectItem of selectedRows) {
            selectedIds.value.add(selectItem.id);
        }
    };

    return {
        selectedIds,
        selectedIdsArray,
        isSelected,
        isAllSelected,
        isSomeSelected,
        toggleSelection,
        toggleAll,
        updateSelection,
    };
}

export default useCheckbox;

```

로직을 분리한것에서 끝나지 말고, 시간복잡도의 성능도 개선을 해야한다.

- 기존 filter 이용을 set 을 이용하여 has 로 판단하도록 한다.
- 변경된 checkbox 내에서는 emit 값이 배열이 아니다. 특정 value 와 type 이 전달될 예정이다.
지금 상위 컴포넌트는 emit 으로 modelValue 를 받고 이를 수정하고 싶지 않으니, 해당 배열로 변경해서 전달할 수 있도록 한다.

실제 Table 내에서 useCheckbox 를 활용한다면

```
<script setup lang=ts>

const {
    selectedIds,
    isSelected,
    isAllSelected,
    isSomeSelected,
    toggleSelection,
    toggleAll,
    updateSelection,
} = useCheckbox(props.selectedRows);

/** 상위 컴포넌트에 특정 옵션이 체크됨을 id 로 알려줍니다. */
const checkOption = (value: { value: DataSource; type: "all" | "single" }) => {
    if (value.type === "all") {
        toggleAll(props.dataSource);
    } else {
        toggleSelection(value.value.id);
    }

    const selectedRows = props.dataSource.filter((item) => selectedIds.value.has(item.id));
    emits("onSelectRows", selectedRows);
};

/** 선택사항 변경 시 갱신 */
watch(
    () => props.selectedRows,
    (newSelectedRows) => {
        // model 내 인자에도 역시나 업데이트
        updateSelection(newSelectedRows || []);
        computedSelectedRows.value = newSelectedRows || [];
    },
    { immediate: true },
);

</script>

```

전체 데이터 (props.dataSource) 를 인자로 전달해주고 이를 기반으로 전체선택, 개별 선택을 진행한다.
진행이 되었다면 내부 selectedIds 가 변경이 되어있을 텐데,
현 set 을 기반으로 selectedRows 를 생성하여 emits 으로 전달해준다.

selectedRows 가 변경된다면, 이를 즉각적으로 update 해준다.

checkbox 의 경우 기존과 달리 checked props 를 원시값으로 설정하여, 특정 변경된 component 만 변경되도록 처리한다.

이제 이를 기반으로 다시 성능 체크를 진행해보자.

!스크린샷 2025-10-10 오후 4.05.23.png

기존 200ms 보단 좀 더 나아진 130 ~110 정도의 속도를 보여주었다.
그리고 기존에 렌더링 시간으로 측정되었던 checkbox 가 사라진것을 확인할 수 있었다.
확신할 순 없겠다만, 컴포넌트 중첩이 없다면 (즉, 기존처럼 HTML element 내 직접적인 bind) 조금 더 빨라지지 않을까 하는 생각이 든다.

그리고 추가적으로 checkbox 방식이 자연스럽게 변경이 되었는데, 기존에는 전체선택 체크박스를 활성화 하고 있다면 무한스크롤을 통해 데이터를 전달받아도
전체선택을 계속해서 유지하는 편이었다.
사용성에 큰 문제는 없지만 상황에 따라서는 새로운 데이터는 추가하고 싶지 않을 수 있을텐데,
지금은 확실히 새로운 데이터는 전체선택에 포함되지 않았다. 개인적으로 괜찮은 변화라 생각이 든다.

# 성능개선에 대한 요약

cursor 의 browserTool 을 통해 실제 performance 탭을 분석하여 개선사항에 대해 리포트를 요청하였다.
아래는 분석사항이다.

---

# 세부 성능 분석

### 1. _sfc_render 함수 호출 패턴 분석

주요 발견:

- 콘솔 로그를 통해 확인한 결과, Checkbox 컴포넌트의 _sfc_render 함수가 성능 그래프에서 거의 보이지 않는 것은 의도한 최적화의 결과입니다. 이는 다음 두 가지 중요한 최적화 덕분입니다:
1. 원시값 전달: checked와 같은 props를 객체 참조가 아닌 원시 boolean 값으로 전달함으로써 불필요한 렌더링이 방지되었습니다. Vue는 원시값이 변경되었을 때만 컴포넌트를 다시 렌더링합니다.
2. 메모이제이션 효과: useCheckbox 컴포저블 내에서 체크 상태를 O(1) 시간 복잡도로 계산함으로써, 체크 상태 계산이 매우 효율적으로 이루어집니다. Set을 사용한 조회는 항목 수와 관계없이 거의 동일한 시간이 소요됩니다.

### 2. 렌더링 성능 세부 분석

데이터 항목 증가에 따른 렌더링 패턴:

- 콘솔 로그에서 볼 수 있듯이, 데이터 항목이 20→40→41→60→120개로 증가함에도 불구하고 렌더링 성능이 선형적으로 저하되지 않았습니다.
- 이는 O(1) 시간 복잡도의 선택 확인 로직이 효과적으로 작동하고 있음을 증명합니다.

체크박스 상태 변화 시 선택적 렌더링:

- 체크박스 상태가 변경될 때, 모든 행이 아닌 변경된 행만 재렌더링되는 것을 확인할 수 있습니다.
- 이는 Set.has(id) 조회가 O(1) 시간 복잡도로 효율적으로 작동하고, 각 행의 체크 상태가 원시 boolean 값으로 전달되어 Vue의 변경 감지 메커니즘이 불필요한 재렌더링을 방지하기 때문입니다.

### 3. 특정 성능 지표 분석

Checkbox 렌더링 시간:

- Checkbox 컴포넌트의 렌더링 시간이 매우 짧은 것을 성능 데이터에서 확인할 수 있습니다. _sfc_render 함수 호출이 거의 보이지 않는 것은 렌더링 시간이 매우 짧아서 성능 그래프에서 거의 드러나지 않기 때문입니다.

상태 계산 효율성:

- isSelected 함수는 Set의 has 메서드를 사용하여 O(1) 시간 복잡도로 계산됩니다. 이는 이전의 selectedRows.some((row) => row.id === source.id) 방식보다 훨씬 효율적으로, 항목 수가 많아져도 성능 저하가 거의 없습니다.

메모리 사용량 최적화:

- 메모리 사용량 측면에서도 최적화가 이루어졌습니다. Set은 ID 값만 저장하므로 전체 객체를 저장하는 것보다 메모리 사용량이 적습니다.

### 4. 실제 개선 사항 증명

시간 복잡도 개선:

- 원래 구현은 selectedRows.some()을 사용하여 O(n) 시간 복잡도였습니다.
- 새 구현은 Set.has()를 사용하여 O(1) 시간 복잡도입니다.

체크박스 상태 변화 시 불필요한 렌더링 방지:

- 이전에는 체크박스 상태가 변경될 때 관련 없는 행도 다시 렌더링될 수 있었습니다.
- 현재는 원시 불리언 값을 사용하여 변경된 행만 다시 렌더링됩니다.

Watcher를 통한 즉각적인 업데이트:

- props.selectedRows가 변경될 때 watch를 통해 즉시 내부 상태를 업데이트하여 반응성을 유지하면서도 성능을 최적화했습니다.

# 결론

분석 결과, 의도한 최적화가 성공적으로 이루어진 것으로 보입니다:

1. Checkbox 컴포넌트의 *sfc_render* 함수가 성능 그래프에서 거의 보이지 않는 것은 원시값 전달과 효율적인 상태 계산으로 인한 최적화의 결과입니다.
2. 체크 상태 계산의 시간 복잡도가 O(n)에서 O(1)로 개선되어 항목 수가 증가해도 성능이 크게 저하되지 않습니다.
3. 선택적 렌더링이 성공적으로 구현되어 변경된 항목만 재렌더링됩니다.
4. Watcher를 통한 즉각적인 상태 업데이트로 반응성을 유지하면서도 성능을 최적화했습니다.

이러한 최적화를 통해 120ms 정도의 렌더링 시간을 유지하면서도 더 많은 데이터를 효율적으로 처리할 수 있게 되었습니다. Row를 순수 element로 전환하면 추가적인 성능 개선이 가능할 것으로 보입니다.

---

분석 결과를 확인해보니 지금까지 의도하였던 개선사항이 잘 적용된것으로 파악이 된다. (확신까지는 못하겠지만..)

# 추가적인 개선 사항이 있다면

프론트엔드에게 있어 렌더링 최적화는 state 를 다루는것 만큼 중요한 작업이다.
나를 좌절 시키는 여러가지 요인들이 있지만, 그 중 렌더링 최적화 역시 마찬가지다. 가끔 내가 프론트엔드 개발자가 적합한지 의문이 들 때가 존재한다..

지금까지 한 작업들에게서 깨달은 바가 있다면 다음과 같다.

- 생각보다 vue 는 렌더링 자체를 잘 해준다. 즉, 별다른 처치를 하지 않아도 알아서 렌더 최적화를 이뤄주려고 노력한다.
- vue 내에서 실행되는 렌더함수의 어떤 실행 속도 같은 부분은 느려진 task 에 많은 영향을 끼치진 않는다.
즉, 뭔가 task 가 느려졌다 하면 다 내 잘못이다..
- 뭔가 서버단이 아니라 우습게 봤었던 시간 복잡도에 대해서 다시 생각하는 계기가 되었다.
사실 배열 1000개 정도는 뭐 크지 않지 않을까 생각했는데, 각 횟수마다 연산되는 함수의 작업 최적화의 지대한 영향을 알게 되었다.
- 반대로 실제 화면 내 1000개 정도의 요소를 렌더링 하는것은 브라우저는 무리없이 해낼 것이라 생각이 들었다.
실제 선택된 문항 삭제로 인한 버벅임의 원인은 단순히 배열 요소를 삭제하고 다시 생성된 배열을 화면에 렌더링 한다고 생기는 이슈가 아니었고,
오히려 상단 문항 검색 테이블의 checkbox 관련 selected 의 함수 이슈였다는 것을 깨달았다.
- vue는 react 보다 뛰어날 테니 알아서 다 해줄 것이라 생각했지만, 역시나 나의 오판이었고 가장 기본이 될 수 있는 props 의 전달 형식에 대해서
지금까지의 나의 행태에 대해 반성하는 계기가 되었다. (react 라면 오히려 더 조심하지 않았을까)
- 컴포넌트를 아무 의미없이 분리하는 것은 성능면에 있어서 좋은 것은 아니었다.

이 외에도 컴포넌트를 생성하고 하는 과정에서 나를 언제나 괴롭혔던 CSS 는 언제나 숙제로 남아있다.
(진짜 잘하는 프론트엔드는 CSS 를 마스터한 사람이 아닐까?)

위에 사항이 깨달은 바라면, 추가적 개선이 있을 곳이 어디일까 고민해보곳은 실제 선택된 문항 테이블 부분이었다.
위 테이블 역시 renderList 를 통해 렌더링을 진행하는데, 문항을 삭제할 때 마다 전체 배열에서 해당 문항을 filter 하고 이를 기반으로 새로운 배열이
table 내 적용이 된다.

아직 자세히 살펴보진 않았지만, 개선 사항이 있다면

- 만일 props 내에서 모든 요소를 렌더링 하게끔 하는 요인이 있다면 이를 바로잡기
- key 를 통해 제대로 변경되는 요소만 적용을 하고 있는지, (즉 같은 id 를 가진 요소들은 그대로 제 렌더링을 하지 않는지) 검토하기
- vue 내에서 요소 삭제로 인한 실제 DOM 변경 시 최적화는 어떤식으로 이루어지는지
- 현재 task 는 여전히 long 하다는 평가가 나오는데, 만일 '선택된 문항 내 문항 삭제로 인한 제렌더링 작업' 과 '검색 문항의 checkbox 변경 작업' 이 병렬적으로 처리될 수 있다면 task 효율은 더욱 증가할 것으로 예상된다.

위 사항들에 대한 점검을 진행해보려고 한다.

# 더 효과적인 방법도 있었을 수 있었다

조금 고생은 했지만 렌더링에 있어 어느정도 최적화를 진행했고, 이 과정에서 사실 여러가지 더 쉽기도 하고 나은 개선사항을 적용할 수 있었다.

- vue-virtualize 적용
- v-memo 적용

실제로 리스트 렌더링에 대한 아주 효과적인 라이브러리 및 내장 함수로서 활용할 수 있었지만, 그러진 않았다.

이유는 간단한데,
내가 지금 겪고 있는 문제가 과연 위 방법으로 해결할 만한 방법인가에 대한 의문이 들었기 때문이다.

많아봤자 1000개 정도의 배열이자 element 이다. 적다면 적고 많다면 많다 하지만, 브라우저의 성능 상 1000개 정도는 충분히 커버가 가능하다고 판단했고,
이미지 리스트도 아니었기에 오히려 지금같은 성능 이슈가 발생해서는 안된다고 판단을 하였다.
그렇기에 다른 쪽에 문제가 있을 것이라 생각했고, 결과적으로 옳은 방향이었다 생각이 든다.