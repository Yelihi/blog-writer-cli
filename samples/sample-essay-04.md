## 문제사항

query 에서 제공하는 useSuspenseQuery 의 경우 문제점들이 있어서, 자체적으로 useSuspenseLikeQuery 를 생성하였고, throw 되는 error 를 ErrorBoundary 를 통해 catch 하여 session 에러의 경우 강제로그아웃을 시킴

해당 부분은 잘 작동하다가, 특정 사항에서 무한 호출이 되는 부분을 발견하였는데,

- 로그인 이후 /free-trial-users 에 접근. (page 0)
- cache 생김
- session 이 만료가 됨 (시간이 지나서)
- 만료 사실을 모르고 page 1 로 이동
- page 1 에 대한 cache 는 존재하지 않음
- 무한 호출이 발생함. (즉 강제 로그아웃까지 가지 않음)

## 해결을 하려면 어디서 문제인지를 파악해야한다

에러를 잡긴 하지만, 강제 로그아웃으로 이동하지는 않는다는 것은 ErrorBoundary 에서 error 를 잡지 못한다는 것과 같다.

신기한 부분은 page 1 으로 이미 이동하여 다시 page 0 으로 가는 등 기존 cache 가 존재하는 상황이라면 강제 로그아웃이 된다는 부분에 있다.
(유추해보건데, cache 가 존재할 때는 errorBoundary 내에서 )

기본적으로 query 요청에서는 retry: false 를 설정하였기에 에러가 발생하더라도 다시 요청이 되지 않도록 설정이 되어있다.

문제가 된 코드는 다음과 같았다.

```tsx
import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { ClientCustomError } from '@/shared/lib/errors/errors';

export function useSuspenseLikeQuery<TData, TError>(opts: UseQueryOptions<TData, TError>) {
  const qc = useQueryClient();
  const { queryKey, queryFn, ...options } = opts;

  const { data, isLoading, error } = useQuery<TData, TError>({
    queryKey,
    queryFn,
    retry: false,
    // 배경 갱신 모두 비활성
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });

  if (isLoading) {
    // 이미 진행 중인 Promise가 있으면 그걸, 없으면 새로 생성
    const query = qc.getQueryCache().find({ queryKey: queryKey! });
    if (!query) throw new ClientCustomError('Query 인스턴스 없음');

    throw query.fetch();
  }

  if (error) {
    throw error;
  }

  return data!;
}

```

의도는 다음과 같았다.

- 해당 query-key 를 가지는 요소는 여러군데 존재할 것이고, 에러가 발생 시 해당 suspenseLike 함수가 실행될 것이고 throw 되는 query.fetch 가 여러군데 존재할 것이라 판단된다
- 이에 중복 요청하지 않도록, 해당 key 에 이미 존재하는 cache 를 가져도오록 하였다. (요청중인 상태라면 해당 cache 를 가져오기)
- 그렇기 때문에 query.fetch() 를 실행하는 것은 한번으로 마무리 하려고 하였던 것이었다.

하지만 무한 호출이 발생하고 있다. cache 가 없을 때만!

## 실행되는 조건을 다시 확인해보자

useQuery 내 isLoading 을 통해 분기처리를 진행하고 있고, 나름 합리적이라 생각이 든다. loading 상태일 때 다른 query 내에서 호출을 하게 되면 동일 cache 에 대한 fetch 를 진행하여 중복하지 않도록 하기 위함이었는데, 이 부분이 문제인 듯 싶다.

query 에서 isLoading 이 true 가 되는 상황은 실제 cache 된 데이터가 존재하지 않을 때 (최근 버전에서는 isPending 으로 변하였다.)이다.
즉, cache 가 존재한다면 백그라운드에서 요청을 진행한다고 해도 isLoading 은 여전히 false 가 된다.

이렇게 되면 설명이 가능하다.

- 캐시된 데이터가 존재한다면, isFetching 이 true 이지 isLoading 은 여전히 false 이다.
- 따라서 해당 코드내에서는 error 분기를 타게되어 throw error 가 발동이 된다.
- 반대로 캐시되지 않은 상황이라면 isLoading 이 true 가 된다.
- 그런데 query.fetch() 가 이루어진다면 다시 요청이 진행이 되게 된다. (즉 error 를 suspense 로 throw 하지 못하고, 전역으로 throw 해버림)
- 저장된 데이터가 없으니 isLoading 은 다시 true 가 된다.
- 다시 query.fetch() 가 실행되어 계속해서 호출이 발생한다.

즉, 내가 만든 useSuspenseLikeQuery 에서는 상위의 ErrorBoundary 가 catch 하려면 반드시 error 를 직접적으로 Throw 해주어야 한다!
하지만 이미 useQuery 내에서 요청시 에러가 발생하고 해당 에러를 그대로 queryClient 내 설정된 onError 가 catch 하면서도, useSuspenseLikeQuery 에서는 throw를 하질 못하니 suspense 로 감싸주는 부분에서 인지를 하지 못하는 것이다.

반대로 cache 가 존재하는 경우 백그라운드 요청에 들어가게 되고 이렇게 되면 isLoading 은 false 이다.
이 경우라면 isLoading 분기를 타지 않고, 바로 error 분기를 타게 되니 error 를 throw 하게 되고, 이를 suspense 가 인지하게 된다.
ErrorBoundary 내에서는 전달받은 error 의 status 를 확인하고 session 에러일 경우 handleLogout 을 걸어버리게 된다.

종합하자면, 내가 의도했던 중복 query.fetch() 를 막기위한 방식이 오히려 무한 호출을 야기해버린 상황인것이다. (어설프게 하다가 이 꼴이 나버렸다)

## 해결책은 여러가지일 것이고 간단하다

가장 간단하게는 그냥 if(error) 분기를 상단으로 이동시키면 된다. error 발생 시 바로 throw 할 수 있도록 말이다.
아니라면 query 내 status 를 판단하여 error 라면 그냥 error 를 trhow 해주면 된다.

```tsx
import { useQuery, useQueryClient, UseQueryOptions } from '@tanstack/react-query';
import { ClientCustomError } from '@/shared/lib/errors/errors';

export function useSuspenseLikeQuery<TData, TError>(opts: UseQueryOptions<TData, TError>) {
  const qc = useQueryClient();
  const { queryKey, queryFn, ...options } = opts;

  const { data, isLoading, error } = useQuery<TData, TError>({
    queryKey,
    queryFn,
    retry: false,
    // 배경 갱신 모두 비활성
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    ...options,
  });

  if (isLoading) {
    // 이미 진행 중인 Promise가 있으면 그걸, 없으면 새로 생성
    const query = qc.getQueryCache().find({ queryKey: queryKey! });
    if (!query) throw new ClientCustomError('Query 인스턴스 없음');

    // 중요! 상태가 에러라면 에러를 바로 던져줍니다. (밑에 error 처리되기 전에 무한 호출이 발생)
    if (query.state.error) {
      throw query.state.error;
    }

    throw query.fetch();
  }

  if (error) {
    throw error;
  }

  return data!;
}

```

> [!note] 추후에는 하나하나 실험해보면서 증명을 해야할 듯 하다
지금 코드는 좀 어지럽기도 하고, 불필요함이 많아 보여서 리펙토링 예정
> 

실제로 이제는 무한 호출은 발생하지 않았다.

## query 에 대한 지식 부족

여전히 구현하면서 체크를 하다보니 query 에 대한 지식기반이 부족함을 느끼고 있다. query 의 코드를 하나하나 까보면서 분석하는것도 좋은 경험이 될 것 같은데, 언제하지..