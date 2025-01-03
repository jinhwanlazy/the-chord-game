terraform {
  backend "gcs" {
    bucket      = "lpr-tfstate-bucket"
    prefix      = "terraform/statefiles/the-chord-game"
  }
  required_version = ">= 1.5.6"
}

provider "google" {
  project     = var.project_id
  region      = var.default_region
  zone        = var.default_zone
}
