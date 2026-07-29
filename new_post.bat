@echo off
rem Opens the dev blog post composer in your default browser.
rem Write your post, click "Save into blog file...", pick devblog.html,
rem then commit & push as usual.
start msedge "%~dp0post_composer.html" -edge
