import { isNewer } from './update-check';

describe('isNewer', () => {
    it('compares numerically, not lexicographically', () => {
        // The bug a string compare would have: "10" < "9" as text.
        expect(isNewer('4.10.0', '4.9.0')).toBe(true);
        expect(isNewer('4.9.0', '4.10.0')).toBe(false);
    });

    it('is false for the same version, so no toast on a fresh install', () => {
        expect(isNewer('4.2.0', '4.2.0')).toBe(false);
    });

    it('handles versions with different segment counts', () => {
        expect(isNewer('4.2.1', '4.2')).toBe(true);
        expect(isNewer('4.2', '4.2.1')).toBe(false);
        expect(isNewer('4.2.0', '4.2')).toBe(false);
    });

    it('treats unparsable segments as 0 rather than NaN-comparing', () => {
        expect(isNewer('4.2.0-beta', '4.2.0')).toBe(false);
        expect(isNewer('', '0.1.0')).toBe(false);
    });
});
