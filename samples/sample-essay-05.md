## 요구사항

아래그림처럼 대단원과 중단원이 소인수분해로 같고, 단계 역시 개념 다지기로 같지만, 문항번호가 1,2,3 번에서 다시 1,2,3번으로 이어진다.
이 경우 각 학습의 단계가 다르면서 해당 단계 내에서의 '개념 다지기' part 이기에 이렇게 구별이 가는 것인데,
이를 실제 테이블 내에서 구별이 가능하기를 원한다.

!스크린샷 2025-10-10 오후 3.01.43.png

조건을 좀 더 세분화 하면 다음과 같다.

- 대단원, 중단원이 같은 경우, 단계 역시 동일할 때 커리큘럼 id 가 차이가 날 경우 이를 집단적으로 구별해주어야 한다.
- 구별은 moduleName - index 형식으로 구별한다.
- 커리큘럼 id 를 기반으로 차이가 발생하지 않을 경우 moduleName 형식으로 호출한다.

## 해결과정

처음에는 단순하게 섹션 이름이 같지만, 커리큘럼 id 가 차이가 날 경우에 한하여 index 를 추가해줄 예정이었다.

```tsx

	// 단순하게 moduleName, curriculumId 를 key 로 하는 이중 Map 을 생성하려고 하였다.
	// 주의할 점은 해당 nameMap 은 singleton 객체로 전역에서 관리되어 사라지지 않도록 처리
    public mappingModuleName = (moduleName: string, curriculumId: number) => {
        if (!this.nameMap.has(moduleName)) {
            this.nameMap.set(moduleName, new Map());
            this.nameMap.get(moduleName)?.set(curriculumId, 0);
        } else {
            const moduleMap = this.nameMap.get(moduleName);

            if (!moduleMap?.has(curriculumId)) {
                moduleMap?.set(curriculumId, moduleMap.size + 1);
            } else {
                return;
            }
        }
    };

    public getNameMap = () => {
        return this.nameMap;
    };

    public resetNameMap = () => {
        this.nameMap = new Map();
    };

    public getIndex = (moduleName: string, curriculumId: number): number => {
        if (!this.nameMap.has(moduleName)) return 0;

        const moduleMap = this.nameMap.get(moduleName);

        if (!moduleMap?.has(curriculumId)) return 0;

        return moduleMap.get(curriculumId) ?? 0;
    };

```

로직은 간단하다.

- 이중 Map 자료구조 형식으로 search 는 curriculumId 를 기반으로 한다.
- 중복되는 curriculumId 가 있다면 이에 해당하는 index 를 반환하고, 아니라면 moduleName 이 가지고 있는 curriculumId 의 size 를 기반으로
새로운 index 를 value 로 가지는 curriculumId 를 key 로 넘겨준다 (set(curriculumId, index))

기존에는 그때그때 moduleName 에 대하여 curriculumId 를 비교함으로서 (마치 클로저처럼) 처리하려고 하였으나,
검색되는 문항이 순서대로 (예를 들어서 '개념 다지기' -> '개념 점검하기') 정직하게 order 가 잡히는것이 아니라, curriculumId 기반으로 order 가 되어있다보니,
'개념 다지기' -> '개념 점검하기' -> '개념 다지기' 와 같은 순서로 작업되는것도 존재하였고, 이렇게 되면 정확하게 section 을 구별할 수 없게 되었다.

각각 섹션의 curriculumId 가 605, 606, 607 이라고 한다면,
'개념 다지기', '개념 점검하기', '개념 다지기-2' 가 되어야 하는데, 직전의 moduleName 이 달라지면 자연스럽게 section 의 index 를 0으로 다시 변경해주었기 때문에 '개념다지기-2' 가 '개념다지기' 로 되어버렸다.

또한 문제는 페이지내이션에서 발생하였는데,
매 convert 마다 Converter 내의 변수로서 moduleName 과 curriculumId 를 다루고 있었다 보니,
새롭게 20개의 데이터를 호출할 때는, 모든 값이 reset 이 되어버리기에,
같은 curriculumId (예를 들어 605) 일지라도, 페이지내이션 경계선에 따라서 '개념 다지기-3' , '개념 다지기' 로 표현되는 경우가 발생했다.

이에 대한 해결책으로, 결론적으로 외부 딕셔너리를 생성하여 이를 참조하는것이 가장 좋겠다 라고 판단하였고, 그래서 생성한것이 위의 이중 Map 자료구조다.
같은 모듈 이름에 다른 curriculumId 를 기반으로 section index 를 value 로 저장하기 때문에,
위 두가지 문제에 대해서 모두 대응이 가능했다.

- curriculumId 기반의 order 내에서도 dictionary 내에서 lookup 하는것이다보니 문제가 없다
- 페이지내이션이 진행되어도, 여전히 외부 dictionary 내에서 확인하는것이라 (초기화되는것이 아닌) 관계가 없다.

```tsx
@singleton()
export default class AcademyProblemsTableConverter {
    constructor(
        @inject(ModuleNameCurriculumIdHandler)
        private moduleNameCurriculumIdHandler: ModuleNameCurriculumIdHandler,
    ) {}

    public convert = (transferProblemSets: TransferProblemSet[]) => {

        const dataSource: TableDataSource[] = transferProblemSets.map((problemSet) => {

			// 우선 외부 dictionary 내에서 mapping 진행
            this.moduleNameCurriculumIdHandler.mappingModuleName(
                problemSet.moduleName,
                problemSet.curriculumId,
            );

			// 해당 curriculumId 에 기반하는 index 가져오기
            const problemSection = this.moduleNameCurriculumIdHandler.getIndex(
                problemSet.moduleName,
                problemSet.curriculumId,
            );

            // 대단원, 중단원이 같으면서 섹션 이름이 같지만 커리큘럼 id 가 다를 경우
            // 이를 구별해줍니다.
            const stepName =
                problemSection > 0
                    ? `${problemSet.moduleName}-${problemSection}`
                    : `${problemSet.moduleName}`;

            const body: TableDataSource = {
                id: String(problemSet.problemId),
                bigUnit: problemSet.bigUnit,
                middleUnit: problemSet.middleUnit || "-",
                curriculumStep: `${stepName} ${problemSet.problemNumber}번\\n${problemSet.middleUnit || "-"}`,
                problemDifficulty: `${problemSet.problemDifficulty}`,
                previewProblem: problemSet.problemImageUrl ?? "",
                problemId: problemSet.problemId ?? 0,
                problemPreviewImageUrl: problemSet.problemImageUrl ?? "",
                problemComment: problemSet.problemComment ?? "",
                answerRate: `-`,
            };

            return body;
        });

        return dataSource;
    };
}

```

## 좀 더 고려했어야 할 사항

애프터 챌린지를 생성할 때, 호출하는 problem 내에서는 괜찮았는데, 실수한 부분이 존재했다.

애프터 챌린지에서는 이미 문제를 호출할 때, 대단원과 중단원이 지정되기 때문에 moduleName 과 curriculumId 만 고려되면 된다.
그런데 비포 챌린지에서는 학생이 풀이한 문제에 대한 기록을 가져오는것이기에, 대단원과 중단원이 고정되지 않는다.
앞선 조건에 대해 다시 리마인드 해보자면,

- 대단원과 중단원이 같을 경우 학습섹션이 같지만 curriculumId 가 다를경우 index 를 구별해준다

즉, 대단원과 중단원이 다르다면 학습섹션의 이름이 같아도 애초에 다른 섹션이기에 따로 index 로 구별해주지 않는것이다.
어쩔수 없게도 좀 더 깊이가 있는 tree 구조로서 관리가 될 필요성이 존재한다.
(이게 대단원, 중단원 등 커리큘럼 쪽은 대부분 이런것 같다.)

```tsx
/**
 * @description
 * 커리큘럼 id 에 대한 index 가 저장됩니다.
 */
class IndexNode {
    public index: number;

    constructor(index: number) {
        this.index = index;
    }
}

```

위 node 는 실제 얻고자 하는 index 값만을 가지는 node 이며, 최종적인 value 내 저장될 node 라고 보면 된다.

```tsx
/**
 * @description
 * 대단원, 중단원, 모듈 이름과 커리큘럼 id 를 기반으로 적합한 section index 를 가지고 있는 Node
 */
class CompositeNode {
    private children: Map<string, CompositeNode | IndexNode> = new Map();

    /**
     *
     * @param path 대단원, 중단원, 모듈 이름, 커리큘럼 id
     * @returns CompositeNode | IndexNode
     */
    public addMapping = (path: (string | number)[]): CompositeNode | IndexNode => {
        // 당연하게도 path 가 빈 배열이면 throw 합니다.
        if (path.length === 0) {
            throw new Error("path is empty");
        }

        // 첫 번째 요소를 가져옵니다.
        const head = path[0].toString();

        // path 길이가 1 이라는 것은 커리큘럼 id 만 존재한다는 것이고, 최종종착지 입니다.
        if (path.length === 1) {
            // 만일 해당 node 가 children 에 없을 경우 (즉, 해당 모듈에 속하는 커리큘럼 id 가 중복되지 않을 경우)
            if (!this.children.has(head)) {
                // 만일 해당 모듈에 속하는 커리큘럼 id 자체가 없을 경우 (처음 추가되는 것이라면)
                // 저장하는 index 를 0 으로 설정합니다.
                if (this.children.size === 0) {
                    const index = 0;
                    this.children.set(head, new IndexNode(index));
                } else {
                    // 아니라면 존재하는 size 에 1을 더해줍니다. (아니라면 0, 1, 2 이런식인데, 그렇게 되면 moduleName - 1 부터 시작하기 때문)
                    const index = this.children.size + 1;
                    this.children.set(head, new IndexNode(index));
                }
            }

            // 사실 node 내 업데이트가 끝났으니 굳이 return 해줄 것은 없지만,
            // 혹여나 추후에 필요할 수 있으니 return
            return this.children.get(head) as IndexNode;

            // path 길이가 1 이상이라면, 1이 될 때 까지 재귀적인 호출이 필요한데,
            // 호출때마다 children 내 요소가 없다면, CompositeNode 를 생성해줍니다.
        } else {
            // node 가 없다면
            if (!this.children.has(head)) {
                const node = new CompositeNode();
                // 생성된 node 를 저장합니다.
                this.children.set(head, node);
            }

            // 해당 node 를 가져옵니다.
            const child = this.children.get(head);

            // 만일 해당 node 가 IndexNode 라면, 즉 커리큘럼 id 만 존재한다면 오류를 발생시킵니다.
            // 구조상 문제가 있는것입니다. (나오면 안됩니다. 왜냐하면 path 가 1 보다 크기 때문입니다.)
            if (child instanceof IndexNode) {
                throw new Error(`${head} 내에서 CompositeNode 가 아닌 IndexNode 가 있습니다.`);
            }

            // 재귀적으로 path 를 감소시키면서 호출합니다.
            return (child as CompositeNode).addMapping(path.slice(1));
        }
    };

    /**
     *
     * @param path 대단원, 중단원, 모듈 이름, 커리큘럼 id
     * @returns 적합한 section index
     */
    public getIndex = (path: (string | number)[]): number => {
        // 당연하게도 path 가 빈 배열이면 throw 합니다.
        if (path.length === 0) {
            throw new Error("path is empty");
        }

        // 첫 번째 요소를 가져옵니다. (대단원)
        // 이를 기반으로 해당 대단원의 자식을 가져옵니다. (중단원)
        const head = path[0].toString();
        const child = this.children.get(head);

        // 만일 해당 대단원의 자식이 없다면, 즉 해당 대단원이 존재하지 않는다면 0 을 반환합니다.
        if (!child) {
            return 0;
        }

        // 만일 path 의 길이가 1 이라면, 즉 커리큘럼 id 만 존재한다면,
        // 해당 대단원의 자식이 IndexNode 인지 CompositeNode 인지 확인하고,
        // 만일 IndexNode 라면 해당 index 를 반환하고, 아니라면 0 을 반환합니다.
        if (path.length === 1) {
            // 사실 마지막은 거진 무조건 IndexNode 이여야 합니다.
            // 그렇기에 대부분은 여기서 return 됩니다.
            if (child instanceof IndexNode) {
                return child.index;
            }
            return 0;
        } else {
            if (child instanceof CompositeNode) {
                // 재귀적으로 path 가 1이 될 때까지 계속해서 search 하면서 찾아갑니다.
                return child.getIndex(path.slice(1));
            }
            return 0;
        }
    };
}

```

CompositeNode 의 경우 대단원, 중단원, moduleName 이 key 가 되고, 그 value 로서 새로운 CompositeNode 를 가지게 된다.
CompositeNode 는 children 을 가지게 되고, 이 children 내부에는 자연스럽게 CompositeNode 가 포함된다.
children 은 Map 이기 때문에 해당 key 에 대한 Node 를 가지게 된다.

tree 구조의 종착점은 앞서 적어둔 IndexNode 가 된다. 그리고 이 IndexNode 의 경우 curriculumId 에 따라 여러개가 될 수 있고(하나의 CompositeNode)
반드시 마지막 value 에만 존재하여야 한다.
즉, 중간 과정에서 IndexNode 가 형성되면 안된다. (그렇기에 instanceof 를 통해 점검해준다. 애초에 생성되면 안된다.)

전달되는 인자는 path 로서 bigunit, middleUnit, modulName, curriculumId 순서로 전달된다.
위 코드에서는 구현되어있지는 않지만, 만약 개선사항이 있다면 단순 string type 이 아니라 실제로 각 단원에 해당하는 값을 전달해주면 좀 더 함수 실행에 있어 안정감이 생성될 수 있다.

다만, 서버 내 Response 내에서도 string 과 id(number) 로 전달되고 있기에, 이 부분을 개선하는건 쉽지 않아 호출하는 쪽에서 엄격하게 따져보고 호출하도록 하였다. (만일 실행에 이상이 있다면 대부분 이 곳에서 발생할 것이고, 이는 server 내 response 구조의 변경에서 착안될 것이다.)

getIndex 를 실행할 때 정확한 index 가 아니면 다 0 을 반환하는데, 이는 false 의 의미로 보면 된다.
return type 을 number 로 통일하기 위함이고, 실제 반환받는 convert 함수 내에서 이를 판단하여 stepName 을 설정해준다.

## 마무리 준비

한가지 잊지 말고 설정해주어야 하는것은,
위 class 는 singleton 으로서 하나의 인스턴스를 가지기 때문에 초기화 작업이 반드시 진행되어야 한다.

- singleton 이어도 관계가 없는것은, 위 class 내 getIndex 를 호출하는 과정은 결코 동시에 이루어질 수 없기 때문이다.
(비포, 애프터 챌린지 페이지, 관리 페이지)
- 생성되는 인스턴스가 가지는 구조가 매 convert 내 순회를 돌면서 새롭게 생성된다면 이는 당연하게도 메모리 낭비가 될 것이기에 singleton 을 사용하기로 하였다.
(tsryinge 를 사용하는 편의성 중 하나다.)
- 다만 전역 인스턴스 이기에 항상 초기화 시점을 고려해야 한다.

그렇다면 언제 초기화를 진행해야 하는가?

우리는 문항을 불러오는 상황을 생각해봐야 한다.

- problem 의 검색 조건이 변경되어 호출할 경우
- pagination 인 상황

pagination 일 경우, 인스턴스를 초기화 하면 안된다. 같은 조건 하에서 계속된 데이터 호출이기에 rootTree 가 변하면 안되기 때문이다.
반면, 조건이 변경된 problem 호출 시에는 호출전 반드시 전역 인스턴스가 초기화 되어야 한다.
그렇지 않으면 첫 검색 시작부터 section index 가 10이 넘어갈 수도 있다.

그렇기에 reset 함수를 생성하였고, 이를 호출해준다.

```tsx
        if (nextToken && pagination) {
            payload.nextToken = nextToken;
        } else {
            // 초기 요청시에는 모듈 이름과 커리큘럼 id 를 매핑하는 루트를 초기화합니다.
            this.moduleNameCurriculumIdHandler.resetRoot();
        }

```

첫 요청때는 초기화, 그렇지 않을 경우는 그대로 인스턴스를 가져간다. 이 과정을 절대 잊지말자..

## 한계와 회고

한계점이 있다면, section index 의 numbering 인데,
페이지내이션 특성상, 그리고 렌더링 효율을 고려할 때 조금 안고 가야할 문제이기도 했다.
예를 들어 설명해보자면

아래 표에서 보여지는 데이터를 처음 문항에 대한 검색이라고 가정해보자.
보여지는 개념테스트는 아직까지 curriculumId 의 차이가 없기 때문에 section index 는 0 이다.
즉, 현재 20개의 데이터(페이지내이션 단위) 내에서는 차이가 나는 curriculumId 는 없다.

!스크린샷 2025-10-10 오후 3.09.45.png

이제 한번 더 페이지내이션이 진행이 된다.
새롭게 받아온 데이터에는 개념 테스트(같은 moduleName) 내 다른 curriculumId 가 존재하였다.
이로 인해 section index 가 새롭게 생성이 되고, -2 로서 적용이 되었다.

!스크린샷 2025-10-10 오후 3.10.08.png

기획의 의도라면 만일 이렇게 다른 curriculumId 가 생성이되면, 그 index 가 1 부터 생성이 되어야 한다.
즉, 페이지내이션 이후 존재하는 개념테스트는 모두 이렇게 되어야 한다.

- 개념 테스트-1
- 개념 테스트-2

하지만 이렇게 하려면 이미 최초에 렌더링 되었던 20개의 테이블 데이터 내에서 개념 테스트만 찾아서 '개념 테스트' -> '개념 테스트-1' 로 변경해주어야 한다.
페이지내이션이 진행될수록 상단에 미리 렌더링 된 데이터들의 추가적인 변경이 필요할 것이며,
만일 다음 페이지내이션(20개 추가)를 통해 총 문항이 600문항등을 넘어가게 되면, 생각보다 수정해야할 table row 값이 많아질 수 있다.
(너무 비효율적이다.)

그래서 이러한 비효율 대신 그냥 0 다음에 2 부터 시작하여

- 개념 테스트
- 개념 테스트-2

이렇게 -1 을 그냥 적지 않는것으로 처리하는것이 모든 부분에서 이득일 것이라 판단하여 작업하였다.
기획부분과 충돌되지만 성능부분이나 유지보수에서 살펴볼 때 이 부분이 더 괜찮다는 판단이 들었다.

매번 간단한 기능이라 판단되지만,
조건을 고려하다보면, 그리고 이러한 기능이 사용되는 여러 환경들까지 고려하다보면 결코 단순한 설계가 되진 않는다.
코드 자체는 그럼에도 단순할 수 있으나 완성까지 오기까지의 과정이 생각보다 복잡했고
한편으로는 기획의 효율성에 대해서 고민해보게 되는 순간이다.