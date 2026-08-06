--!strict
-- TestEZ globals. Loaded into luau-lsp via --definitions when a project declares
-- a [test] testez path, so the describe/it/expect functions TestEZ injects into
-- *.spec files at runtime resolve in the editor.

type Expectation = {
	to: Expectation,
	be: Expectation,
	been: Expectation,
	have: Expectation,
	was: Expectation,
	at: Expectation,
	never: Expectation,
	a: (className: string) -> Expectation,
	an: (className: string) -> Expectation,
	ok: () -> Expectation,
	equal: (value: any) -> Expectation,
	near: (value: number, limit: number?) -> Expectation,
	throw: (messageSubstring: string?) -> Expectation,
}

declare function expect(value: any): Expectation

declare function describe(phrase: string, callback: () -> ()): ()
declare function describeFOCUS(phrase: string, callback: () -> ()): ()
declare function describeSKIP(phrase: string, callback: () -> ()): ()
declare function fdescribe(phrase: string, callback: () -> ()): ()
declare function xdescribe(phrase: string, callback: () -> ()): ()

declare function it(phrase: string, callback: () -> ()): ()
declare function itFOCUS(phrase: string, callback: () -> ()): ()
declare function itSKIP(phrase: string, callback: () -> ()): ()
declare function itFIXME(phrase: string, callback: () -> ()): ()
declare function fit(phrase: string, callback: () -> ()): ()
declare function xit(phrase: string, callback: () -> ()): ()

declare function FOCUS(): ()
declare function SKIP(): ()

declare function beforeAll(callback: () -> ()): ()
declare function beforeEach(callback: () -> ()): ()
declare function afterAll(callback: () -> ()): ()
declare function afterEach(callback: () -> ()): ()
