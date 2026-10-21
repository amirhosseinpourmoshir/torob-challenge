import re
import unicodedata

TRANSLATION = str.maketrans('يك٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', 'یک01234567890123456789')


def normalize_search(value):
    text = unicodedata.normalize('NFKC', value or '').translate(TRANSLATION).lower()
    text = ''.join(c for c in text if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', re.sub(r'[^\w]+', ' ', text.replace('\u200c', ' '))).strip()
