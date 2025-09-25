class MathParser {
    constructor() {
        // math.js 라이브러리 확인
        if (typeof math === 'undefined') {
            console.error('math.js library not loaded!');
            return;
        }
        
        console.log('math.js loaded successfully');
        
        // 간단한 테스트
        try {
            const testExpr = math.compile('2 + 3');
            const testResult = testExpr.evaluate({});
            console.log('Basic math test: 2 + 3 =', testResult);
            
            // mod 함수 테스트
            const modExpr = math.compile('mod(5, 2)');
            const modResult = modExpr.evaluate({});
            console.log('Mod test: mod(5, 2) =', modResult);
        } catch (e) {
            console.error('Math.js test failed:', e);
        }
        
        // math.js 스코프 생성
        this.mathScope = {
            // 기본 변수들
            x: 0,
            y: 0,
            z: 0,
            
            // 추가 함수들 (math.js에 없는 경우를 대비)
            fract: (x) => x - Math.floor(x),
            clamp: (x, min, max) => Math.max(min, Math.min(max, x)),
            lerp: (a, b, t) => a + t * (b - a),
            step: (edge, x) => x < edge ? 0 : 1,
            smoothstep: (edge0, edge1, x) => {
                const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
                return t * t * (3 - 2 * t);
            }
        };
    }

    // math.js 문법에 맞게 수식 전처리
    preprocessExpression(expression) {
        let processed = expression;
        
        // 함수 정의 제거 (f(x,y) = ... -> ...)
        processed = processed.replace(/^[a-zA-Z]\([^)]*\)\s*=\s*/, '');
        
        // 공백 제거
        processed = processed.replace(/\s+/g, '');
        
        // ^ 연산자를 ** 로 변환
        processed = processed.replace(/\^/g, '**');
        
        // e^ 표현을 exp()로 변환 (e**(...) -> exp(...))
        processed = processed.replace(/e\*\*\(/g, 'exp(');
        
        // % 연산자를 mod()로 변환 (더 정확한 패턴)
        processed = processed.replace(/\)%(\d+)/g, ') mod $1');
        processed = processed.replace(/(\w+)%(\d+)/g, '$1 mod $2');
        processed = processed.replace(/(\d+)%(\d+)/g, '$1 mod $2');
        
        // *mod 패턴을 mod로 수정 (공백 문제 해결)
        processed = processed.replace(/\*mod(\d+)/g, ' mod $1');
        processed = processed.replace(/([a-zA-Z\)])mod(\d+)/g, '$1 mod $2');
        
        // 암시적 곱셈 처리 (3x -> 3*x, 2sin -> 2*sin)
        processed = processed.replace(/(\d)([a-zA-Z])/g, '$1*$2');
        processed = processed.replace(/(\d)\(/g, '$1*(');
        processed = processed.replace(/\)([a-zA-Z])/g, ')*$1');
        processed = processed.replace(/\)\(/g, ')*(');
        
        console.log(`Preprocessed: "${expression}" -> "${processed}"`);
        return processed;
    }

    // 수식을 함수로 컴파일
    compileFunction(expression) {
        try {
            console.log(`Compiling expression: "${expression}"`);
            
            // math.js 사용 가능 여부 확인
            if (typeof math === 'undefined') {
                throw new Error('math.js library not loaded');
            }
            
            // 수식 전처리
            const processedExpression = this.preprocessExpression(expression);
            
            // math.js로 표현식 컴파일
            const compiledExpr = math.compile(processedExpression);
            console.log('Successfully compiled expression');
            
            // 테스트 실행
            const testResult1 = compiledExpr.evaluate({ ...this.mathScope, x: 0, y: 0, z: 0 });
            console.log(`Test result for (0,0,0): ${testResult1}`);
            
            const testResult2 = compiledExpr.evaluate({ ...this.mathScope, x: 1, y: 1, z: 0 });
            console.log(`Test result for (1,1,0): ${testResult2}`);
            
            // 래퍼 함수 반환
            return (x, y, z) => {
                try {
                    const result = compiledExpr.evaluate({ ...this.mathScope, x, y, z });
                    
                    if (typeof result !== 'number' || !isFinite(result)) {
                        // 더 자세한 디버깅 정보
                        if (Math.abs(x) < 0.1 && Math.abs(y) < 0.1) {
                            console.warn('Invalid result details:');
                            console.warn('  Original expression:', expression);
                            console.warn('  Processed expression:', processedExpression);
                            console.warn('  Result:', result, 'Type:', typeof result);
                            console.warn('  Input:', x, y, z);
                        }
                        return 0;
                    }
                    
                    return result;
                } catch (e) {
                    console.error('Function execution error:', e, 'for input:', x, y, z);
                    console.error('Expression:', expression);
                    return 0;
                }
            };
        } catch (error) {
            console.error('수식 컴파일 오류:', error);
            console.error('Expression:', expression);
            return () => 0; // 기본값 반환 함수
        }
    }

    // 수식 검증
    validateExpression(expression) {
        try {
            const func = this.compileFunction(expression);
            // 테스트 값으로 실행해보기
            const testResult = func(1, 1, 1);
            return {
                valid: true,
                function: func,
                message: '유효한 수식입니다.'
            };
        } catch (error) {
            return {
                valid: false,
                function: null,
                message: `수식 오류: ${error.message}`
            };
        }
    }

    // 다중 수식 처리
    compileMultipleExpressions(expressions) {
        const compiledFunctions = [];
        
        for (let expr of expressions) {
            const validation = this.validateExpression(expr.formula);
            if (validation.valid) {
                compiledFunctions.push({
                    function: validation.function,
                    compiledCode: expr.formula, // 원본 수식을 그대로 전달
                    color: expr.color || '#00ff00',
                    formula: expr.formula
                });
            } else {
                console.warn(`수식 "${expr.formula}" 컴파일 실패:`, validation.message);
            }
        }
        
        return compiledFunctions;
    }
}

// 전역 인스턴스 생성
window.mathParser = new MathParser(); 