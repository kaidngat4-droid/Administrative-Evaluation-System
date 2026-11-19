#!/bin/bash
set -e
rm -rf www && mkdir -p www
cp -r index.html login.html reports.html users.html offline.html manifest.json css js assets www/
: > www/js/sw-register.js
echo "www جاهز"
