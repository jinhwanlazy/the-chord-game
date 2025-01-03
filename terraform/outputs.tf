
# Add to main.tf or create outputs.tf
output "bucket_url" {
  value = "https://storage.googleapis.com/${google_storage_bucket.website.name}"
}

output "website_url" {
  value = "https://${var.domain_name}"
}
