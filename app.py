from flask_cors import CORS
from flask import Flask, request, jsonify
from groq import Groq

app = Flask(__name__)
CORS(app)

client = Groq(api_key="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")

@app.route("/check", methods=["POST"])
def check_news():
    data = request.get_json()
    news_text = data.get("text")

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {
                    "role": "user",
                    "content": f"Tell whether this news is Fake or Real and give short reason:\n{news_text}"
                }
            ]
        )

        result = response.choices[0].message.content
        return jsonify({"result": result})

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == "__main__":
    app.run(debug=True)
