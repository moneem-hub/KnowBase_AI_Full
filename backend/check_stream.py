import json
import sys
import httpx

conv_id = int(sys.argv[1])
question = sys.argv[2]
url = f"http://127.0.0.1:8000/conversations/{conv_id}/messages/stream"

with httpx.stream("POST", url, json={"content": question}, timeout=120) as r:
    for line in r.iter_lines():
        if not line.startswith("data: "):
            continue
        event = json.loads(line[6:])
        if event["type"] == "sources":
            print("[sources:", [(s["page"], s["score"]) for s in event["sources"]], "]")
        elif event["type"] == "token":
            print(event["text"], end="", flush=True)
        elif event["type"] == "done":
            print("\n[done, message id", event["message_id"], "]")
        elif event["type"] == "error":
            print("\n[error]", event["detail"])