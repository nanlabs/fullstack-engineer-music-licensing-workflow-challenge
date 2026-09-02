variable "project" {
  type = string
}

variable "environment" {
  type = string
}

variable "name" {
  type        = string
  description = "Repository name suffix, e.g. \"backend\"."
}
