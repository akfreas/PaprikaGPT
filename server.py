from flask import Flask, request, send_file
import gzip
import io
import zipfile
import os
import json

app = Flask(__name__)

@app.route('/prepare-paprikarecipe', methods=['POST'])
def prepare_paprikarecipe():
    # Read the incoming data
    data = request.data
    parsed_data = json.loads(data)
    recipe_name = parsed_data['name']
    # Gzip the data
    gzip_buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=gzip_buffer, mode='wb') as gzip_file:
        gzip_file.write(data)
    gzip_buffer.seek(0)

    # Create a zip file and add the gzipped data
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'a', zipfile.ZIP_DEFLATED, False) as zip_file:
        zip_file.writestr(f'{recipe_name}.paprikarecipe', gzip_buffer.getvalue())
    zip_buffer.seek(0)

    # Return the zip file
    return send_file(zip_buffer, download_name=f'{recipe_name}.paprikarecipes', as_attachment=True)

if __name__ == '__main__':
    app.run(debug=True)
