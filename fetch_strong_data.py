import os
import requests
from tqdm import tqdm

DEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cvedata")
os.makedirs(DEST, exist_ok=True)

DATASETS = {
    "diversevul": {
        "repo": "bstee615/diversevul",
        "files": [
            "data/train-00000-of-00002-06b0cca04c9bb0f2.parquet",
            "data/train-00001-of-00002-0fb7d9c1c879fb27.parquet",
            "data/validation-00000-of-00001-4e4cf40ca95c048a.parquet",
            "data/test-00000-of-00001-467ddf31930d18ee.parquet"
        ]
    },
    "bigvul": {
        "repo": "bstee615/bigvul",
        "files": [
            "data/train-00000-of-00001-c6410a8bb202ca06.parquet",
            "data/validation-00000-of-00001-d21ad392180d1f79.parquet",
            "data/test-00000-of-00001-d20b0e7149fa6eeb.parquet"
        ]
    },
    "pycodevul": {
        "repo": "S-AIR-L/PyCode-Vul",
        "files": [
            "PyCode_Vul-%20train-set.csv",
            "PyCode_Vul%20test-set.csv"
        ]
    },
    "cvefixes": {
        "repo": "DetectVul/CVEFixes",
        "files": [
            "data/train-00000-of-00001-e16c38c44535197b.parquet",
            "data/test-00000-of-00001-4be7d978ce504ad6.parquet"
        ]
    }
}

BASE_URL = "https://huggingface.co/datasets/{repo}/resolve/main/{path}"

def download_file(url, dest_path):
    if os.path.exists(dest_path):
        print(f"  이미 있음: {os.path.basename(dest_path)}")
        return
    
    print(f"  다운로드 중: {url}")
    response = requests.get(url, stream=True)
    total_size = int(response.headers.get('content-length', 0))
    
    with open(dest_path, 'wb') as f:
        for data in response.iter_content(chunk_size=1024*1024):
            f.write(data)
    print(f"    완료: {dest_path} ({os.path.getsize(dest_path)//1024//1024}MB)")

def main():
    for name, config in DATASETS.items():
        repo_dir = os.path.join(DEST, name)
        os.makedirs(repo_dir, exist_ok=True)
        for path in config["files"]:
            url = BASE_URL.format(repo=config["repo"], path=path)
            # URL 인코딩된 파일명 처리
            filename = os.path.basename(path).replace("%20", " ")
            dest_path = os.path.join(repo_dir, filename)
            download_file(url, dest_path)

if __name__ == "__main__":
    main()
