# website-screenshot-compare  
This is a simple Playwright screenshot comparison script.

## Steps to run

```bash
docker run --rm -it --network xxxx -v $(pwd)/urls.json:/app/urls.json -v $(pwd)/diffs:/app/diffs -e BASIC_AUTH_USERNAME="xxxxxx" -e BASIC_AUTH_PASSWORD="xxxxxxx" michabbb/website-screenshot-compare
```

This script is designed for the following setup:

- You have a locally running web server in another container (your development server).  
- You have a website that is publicly available on the internet (optionally accessible only via basic authentication).  
- You have a `urls.json` file containing multiple URLs you want to compare.  

## urls.json

```json
[
  {
    "live": "https://something.com/live1",
    "dev": "http://my-local-docker-container/dev1",
    "dev_browser": "http://local.test/dev1"
  },
  {
    "live": "https://something.com/live2",
    "dev": "http://my-local-docker-container/dev2",
    "dev_browser": "http://local.test/dev2"
  },
]
```

Playwright compares screenshots of `live` and `dev`.
Before a screenshot gets taken, GIF Images get replaced with a placeholder image to avoid any timing issues: `https://placehold.co/AAAxBBB` 

| Key            | Description                                                                                                                  |
|----------------|------------------------------------------------------------------------------------------------------------------------------|
| **live**       | The URL that Playwright accesses (publicly available).                                                                       |
| **dev**        | The URL that Playwright accesses (e.g., your local development server).                                                      |
| **dev_browser**| Displayed in the summary when a mismatch is found, allowing you to quickly open the development URL in your browser.         |

## example output

```bash
Summary of differing URL pairs:
1. Differences found
   Live: https://something.com/live1
   Dev: http://my-local-docker-containe/dev1
   Dev Browser: http://local.test/dev1
   Diff image: diffs/diff-1-1740156909377.png
```

**Red areas in the diff image indicate differences between the live and dev screenshots.** ‼️