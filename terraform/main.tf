resource "google_storage_bucket" "website" {
  name          = var.domain_name
  location      = var.default_location
  force_destroy = true

  website {
    main_page_suffix = "index.html"
    not_found_page   = "index.html"
  }

  uniform_bucket_level_access = true
}

resource "google_storage_bucket_iam_member" "public_read" {
  bucket = google_storage_bucket.website.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

resource "google_storage_bucket_object" "static_files" {
  for_each = fileset("${path.root}/../build", "**/*")

  name   = each.value
  source = "${path.root}/../build/${each.value}"
  bucket = google_storage_bucket.website.name

  content_type = lookup({
    ".html" = "text/html",
    ".css"  = "text/css",
    ".js"   = "application/javascript",
    ".json" = "application/json",
    ".ico"  = "image/x-icon",
    ".png"  = "image/png",
    ".jpg"  = "image/jpeg",
    ".svg"  = "image/svg+xml",
  }, regex("\\.[^.]+$", each.value), "text/plain")
}
