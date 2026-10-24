/** fetch-work24 순수 함수. 네트워크·파일을 쓰지 않는다(DATA-07: 시험은 고용24를 부르지 않는다). */
import { describe, expect, it } from 'vitest'
import {
  cacheRel,
  canonicalParams,
  countBy,
  leadSentences,
  leafRecord,
  findAll,
  parseXml,
  pickNcs,
  redact,
  requestUrl,
  responseError,
  similarity,
  splitBrands,
  type Req,
} from './lib.ts'

const req: Req = { svc: '215L01', hint: 'BE01', params: { returnType: 'JSON', jobCont: '서버프로그램구현', limit: '10' } }

describe('캐시 이름·요청 주소', () => {
  it('캐시 이름은 요청 값으로만 정해지고 키가 들어가지 않는다', () => {
    const withKey: Req = { ...req, params: { ...req.params, authKey: 'SECRET-KEY-1234567890' } }
    expect(cacheRel(withKey)).toBe(cacheRel(req))
    expect(cacheRel(req)).toMatch(/^215L01\/BE01-[0-9a-f]{10}\.json$/)
    expect(canonicalParams(withKey.params)).not.toContain('SECRET')
    expect(cacheRel({ ...req, params: { ...req.params, jobCont: 'SQL활용' } })).not.toBe(cacheRel(req))
  })

  it('XML 요청은 .xml, 주소 앞부분은 고용24 오픈API, 띄어쓰기는 %20', () => {
    const xml: Req = { svc: '21L01', hint: 'cmcd-dtl1', params: { returnType: 'XML', target: 'CMCD', dtlGb: '1' } }
    expect(cacheRel(xml)).toMatch(/\.xml$/)
    const url = requestUrl({ ...req, params: { ...req.params, jobCont: 'a b' } }, 'KEY')
    expect(url.startsWith('https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo215L01.do?authKey=KEY&')).toBe(true)
    expect(url).toContain('jobCont=a%20b')
  })

  it('출력에서 키를 가린다', () => {
    expect(redact('…?authKey=abcdef123456&x=1 abcdef123456', ['abcdef123456'])).toBe('…?authKey=***&x=1 ***')
  })
})

describe('응답 읽기', () => {
  it('XML 을 나무로 읽고 잎 노드를 모은다(엔티티·CDATA 포함)', () => {
    const root = parseXml(
      '<?xml version="1.0" encoding="UTF-8"?><list><total>2</total><item><cd>11000</cd><nm>서울 &amp; 경기</nm></item><item><cd>41000</cd><nm><![CDATA[경기]]></nm></item></list>',
    )
    const items = findAll(root, 'item').map(leafRecord)
    expect(items).toEqual([
      { cd: '11000', nm: '서울 & 경기' },
      { cd: '41000', nm: '경기' },
    ])
    expect(findAll(root, 'total')[0]?.text).toBe('2')
  })

  it('오류 응답을 알아본다: XML <error>, 직무정보 message_cd, JSON 이 아닌 글', () => {
    expect(responseError('<?xml version="1.0"?><error>개인회원은 사용할 수 없는 OPEN-API입니다.</error>', false)).toBe(
      '개인회원은 사용할 수 없는 OPEN-API입니다.',
    )
    expect(responseError('{"message_cd":"011","message":"키워드가 입력되지 않았습니다."}', true)).toBe('011 키워드가 입력되지 않았습니다.')
    expect(responseError('<html>점검 중</html>', true)).not.toBeNull()
    expect(responseError('', false)).not.toBeNull()
  })

  it('빈 결과는 오류가 아니다(응답에 맞는 것이 없을 뿐)', () => {
    expect(responseError('{"result":{}}', true)).toBeNull()
    expect(responseError('<?xml version="1.0"?><root><total>0</total></root>', false)).toBeNull()
  })
})

describe('NCS 능력단위 고르기', () => {
  const items = [
    { centerLabel: '동적모델 설계', ablt_unit: '2001020223' },
    { centerLabel: '서버프로그램 구현', ablt_unit: '2001020211' },
    { centerLabel: '애플리케이션 테스트 관리', ablt_unit: '2001020227' },
  ]

  it('기존 이름과 같은 것(띄어쓰기·괄호 무시)을 응답 순위와 함께 고른다', () => {
    const pick = pickNcs(items, ['서버프로그램 구현 (배치 프로그램 구현하기)'], 'centerLabel')
    expect(pick).toMatchObject({ rank: 2, how: 'same', score: 1 })
    expect(pick?.item.ablt_unit).toBe('2001020211')
  })

  it('같은 이름이 없으면 가장 가까운 것, 그것도 멀면 null(matched: false)', () => {
    expect(pickNcs(items, ['애플리케이션 테스트 수행'], 'centerLabel')).toMatchObject({ rank: 3, how: 'closest' })
    expect(pickNcs(items, ['보안 운영관리'], 'centerLabel')).toBeNull()
    expect(pickNcs([], ['서버프로그램 구현'], 'centerLabel')).toBeNull()
    expect(similarity('화면 구현', '인터페이스 구현')).toBeLessThan(0.6)
  })
})

describe('직업정보·강소기업 정리', () => {
  it('앞 문장을 글자 수 안에서 모은다(첫 문장은 길어도 넣는다)', () => {
    expect(leadSentences('가나다. 라마바사.  아자차카타파하.', 10)).toBe('가나다. 라마바사.')
    expect(leadSentences('아주 긴 첫 문장입니다.', 3)).toBe('아주 긴 첫 문장입니다.')
  })

  it('인증 종류를 낱개로 세고 많은 순으로', () => {
    expect(splitBrands('A, B|C')).toEqual(['A', 'B', 'C'])
    const rows = [{ b: 'A' }, { b: 'B, A' }, { b: '' }]
    expect(countBy(rows, (r) => splitBrands(r.b))).toEqual([
      { key: 'A', count: 2 },
      { key: 'B', count: 1 },
    ])
  })
})
