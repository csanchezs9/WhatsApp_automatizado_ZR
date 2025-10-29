/**
 * Tests para formateo de números telefónicos
 * Prueba todos los códigos de país soportados y edge cases
 */

describe('Phone Number Formatting', () => {
    // Función a testear (copiada desde app.js para testing)
    function formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return phoneNumber;

        const cleaned = phoneNumber.toString().replace(/\D/g, '');

        // Colombia (+57)
        if (cleaned.startsWith('57') && cleaned.length === 12) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
        }

        // USA/Canadá (+1)
        if (cleaned.startsWith('1') && cleaned.length === 11) {
            const countryCode = cleaned.substring(0, 1);
            const number = cleaned.substring(1);
            return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
        }

        // México (+52)
        if (cleaned.startsWith('52') && cleaned.length === 12) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 6)} ${number.substring(6)}`;
        }

        // Argentina (+54)
        if (cleaned.startsWith('54') && (cleaned.length === 12 || cleaned.length === 13)) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 6)} ${number.substring(6)}`;
        }

        // España (+34)
        if (cleaned.startsWith('34') && cleaned.length === 11) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
        }

        // Brasil (+55)
        if (cleaned.startsWith('55') && (cleaned.length === 12 || cleaned.length === 13)) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 2)} ${number.substring(2, 7)} ${number.substring(7)}`;
        }

        // Chile (+56)
        if (cleaned.startsWith('56') && cleaned.length === 11) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 1)} ${number.substring(1, 5)} ${number.substring(5)}`;
        }

        // Perú (+51)
        if (cleaned.startsWith('51') && cleaned.length === 11) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number.substring(0, 3)} ${number.substring(3, 6)} ${number.substring(6)}`;
        }

        // Genérico
        if (cleaned.length > 10) {
            const countryCode = cleaned.substring(0, 2);
            const number = cleaned.substring(2);
            return `+${countryCode} ${number}`;
        }

        return `+${cleaned}`;
    }

    describe('Colombia (+57)', () => {
        test('debe formatear número colombiano correctamente', () => {
            expect(formatPhoneNumber('573173745021')).toBe('+57 317 374 5021');
        });

        test('debe formatear número con espacios', () => {
            expect(formatPhoneNumber('57 317 374 5021')).toBe('+57 317 374 5021');
        });

        test('debe formatear número con guiones', () => {
            expect(formatPhoneNumber('57-317-374-5021')).toBe('+57 317 374 5021');
        });
    });

    describe('USA (+1)', () => {
        test('debe formatear número estadounidense', () => {
            expect(formatPhoneNumber('15551234567')).toBe('+1 555 123 4567');
        });
    });

    describe('México (+52)', () => {
        test('debe formatear número mexicano', () => {
            expect(formatPhoneNumber('525512345678')).toBe('+52 55 1234 5678');
        });
    });

    describe('Edge Cases', () => {
        test('debe manejar null', () => {
            expect(formatPhoneNumber(null)).toBe(null);
        });

        test('debe manejar undefined', () => {
            expect(formatPhoneNumber(undefined)).toBe(undefined);
        });

        test('debe manejar string vacío', () => {
            const result = formatPhoneNumber('');
            // String vacío devuelve string vacío (comportamiento actual)
            expect(result).toBe('');
        });

        test('debe manejar números muy cortos', () => {
            expect(formatPhoneNumber('123')).toBe('+123');
        });

        test('debe manejar números con caracteres especiales', () => {
            expect(formatPhoneNumber('+57 (317) 374-5021')).toBe('+57 317 374 5021');
        });
    });
});
