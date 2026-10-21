from django.db import models
from django.contrib.postgres.indexes import GinIndex


class DatasetImport(models.Model):
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
    manifest = models.JSONField(default=dict)
    counts = models.JSONField(default=dict)
    quality = models.JSONField(default=dict)
    schema_version = models.PositiveIntegerField(default=1)


class Category(models.Model):
    name = models.CharField(max_length=512, primary_key=True)


class Shop(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    name = models.TextField()
    address = models.TextField(null=True)
    location_label = models.TextField(null=True)
    latitude = models.FloatField()
    longitude = models.FloatField()
    website_url = models.TextField(null=True)
    instagram = models.JSONField(null=True)
    supports_fast_delivery = models.BooleanField(null=True)
    name_is_synthetic = models.BooleanField(default=True)
    contacts_are_synthetic = models.BooleanField(default=True)
    weekly_hours = models.JSONField(default=dict)
    search_text = models.TextField()
    source_data = models.JSONField()
    categories = models.ManyToManyField(Category, through='ShopCategory')
    dataset_import = models.ForeignKey(DatasetImport, on_delete=models.PROTECT)

    class Meta:
        indexes = [models.Index(fields=['latitude', 'longitude']),
                   GinIndex(fields=['search_text'], opclasses=['gin_trgm_ops'], name='shop_search_trgm')]


class ShopCategory(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['shop', 'category'], name='unique_shop_category')]


class Product(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    persian_title = models.TextField(null=True)
    brand_name = models.TextField(null=True, db_index=True)
    model = models.TextField(null=True)
    category = models.ForeignKey(Category, on_delete=models.PROTECT)
    image_urls = models.JSONField(default=list)
    specs = models.JSONField(default=list)
    search_text = models.TextField()
    source_data = models.JSONField()
    dataset_import = models.ForeignKey(DatasetImport, on_delete=models.PROTECT)

    class Meta:
        indexes = [GinIndex(fields=['search_text'], opclasses=['gin_trgm_ops'], name='product_search_trgm'),
                   GinIndex(fields=['specs'], name='product_specs_gin')]


class Offer(models.Model):
    id = models.CharField(max_length=64, primary_key=True)
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='offers')
    shop = models.ForeignKey(Shop, on_delete=models.PROTECT, related_name='offers')
    seller_title = models.TextField()
    description = models.TextField(blank=True)
    price_toman = models.BigIntegerField(null=True)
    last_price_changed_at = models.DateTimeField(null=True)
    warranty = models.JSONField(null=True)
    availability_status = models.CharField(max_length=24, default='unverified')
    availability_verified_at = models.DateTimeField(null=True)
    source_data = models.JSONField()
    dataset_import = models.ForeignKey(DatasetImport, on_delete=models.PROTECT)

    class Meta:
        indexes = [models.Index(fields=['product', 'price_toman']), models.Index(fields=['shop', 'product'])]
        constraints = [models.CheckConstraint(condition=models.Q(price_toman__gte=0) | models.Q(price_toman__isnull=True), name='offer_price_nonnegative')]


class ShopContact(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='contacts')
    position = models.PositiveIntegerField()
    channel = models.CharField(max_length=64)
    details = models.JSONField()
    is_synthetic = models.BooleanField(default=True)
    is_publishable = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['shop', 'position'], name='unique_shop_contact')]


class PaymentOption(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='payment_options')
    position = models.PositiveIntegerField()
    provider_name = models.TextField(db_index=True)
    channel = models.CharField(max_length=64, db_index=True)
    min_price_toman = models.BigIntegerField(null=True)
    max_price_toman = models.BigIntegerField(null=True)
    category_names = models.JSONField(default=list)
    source_data = models.JSONField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=['shop', 'position'], name='unique_shop_payment')]


class OpeningDay(models.Model):
    shop = models.ForeignKey(Shop, on_delete=models.CASCADE, related_name='opening_days')
    weekday = models.CharField(max_length=3)
    status = models.CharField(max_length=32, db_index=True)
    shifts = models.JSONField(default=list)

    class Meta:
        constraints = [models.UniqueConstraint(fields=['shop', 'weekday'], name='unique_shop_day')]
