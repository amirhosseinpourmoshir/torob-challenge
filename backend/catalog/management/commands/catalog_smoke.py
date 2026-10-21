import json
from django.core.management.base import BaseCommand, CommandError
from catalog.services import search_products, find_sellers


class Command(BaseCommand):
    help = "Exercise agent-facing tools using imported data without exposing contacts."

    def handle(self, *args, **options):
        products = search_products("هدفون", limit=5)
        if not products:
            raise CommandError("Expected headphones search to return products")
        results = []
        for product in products:
            sellers = find_sellers(product["product_id"], latitude=35.71, longitude=51.41, sort="distance", limit=3)
            results.append({"product_id": product["product_id"], "title": product["title"], "seller_count_in_sample": len(sellers), "example": sellers[:1]})
        self.stdout.write(json.dumps(results, ensure_ascii=False, indent=2))
