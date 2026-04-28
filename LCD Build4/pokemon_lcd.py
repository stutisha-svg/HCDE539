import serial
import requests
import time
from PIL import Image
import io

PORT = 'COM4'
BAUD = 9600

ROCK_TYPES = {"rock", "ground", "steel"}  # ground/steel also count as rocky

def fetch_pokemon(pokemon_id):
    print(f"  Calling PokéAPI for #{pokemon_id}...")
    r = requests.get(
        f"https://pokeapi.co/api/v2/pokemon/{pokemon_id}",
        timeout=10
    )
    if r.status_code != 200:
        return None
    data = r.json()

    name     = data['name'].upper()
    types    = [t['type']['name'].capitalize() for t in data['types']]
    type_str = '/'.join(types)

    # Best attack stat
    stats    = {s['stat']['name']: s['base_stat'] for s in data['stats']}
    atk      = max(stats.get('attack', 0), stats.get('special-attack', 0))
    stat_str = f"ATK:{atk}"

    # Sprite
    sprite_url = data['sprites']['front_default']
    if not sprite_url:
        sprite_url = (data['sprites']['other']
                          ['official-artwork']['front_default'])

    img_bytes = requests.get(sprite_url, timeout=10).content
    return name, type_str, stat_str, img_bytes


def sprite_to_lcd_chars(img_bytes):
    img = Image.open(io.BytesIO(img_bytes)).convert('RGBA')
    bg  = Image.new('RGBA', img.size, (255, 255, 255, 255))
    bg.paste(img, mask=img.split()[3])
    img = bg.convert('L').resize((20, 16), Image.LANCZOS)

    pixel_list = sorted(img.getdata())
    threshold  = pixel_list[len(pixel_list) // 2]
    threshold  = max(60, min(200, threshold))
    print(f"  Threshold: {threshold}")

    pixels    = img.load()
    char_data = []

    for tile_row in range(2):
        for tile_col in range(4):
            char_bytes = []
            for py in range(8):
                byte = 0
                for px in range(5):
                    x = tile_col * 5 + px
                    y = tile_row * 8 + py
                    if pixels[x, y] < threshold:
                        byte |= (1 << (4 - px))
                char_bytes.append(byte)
            char_data.append(char_bytes)

    return char_data


def send_to_arduino(ser, name, type_str, stat_str, char_data):
    def tx(line):
        ser.write((line + '\n').encode())
        time.sleep(0.06)

    tx(f"NAME:{name}")
    tx(f"TYPE:{type_str}")
    tx(f"STAT:{stat_str}")
    for i, cb in enumerate(char_data):
        tx(f"CHAR:{i}:{','.join(str(b) for b in cb)}")
    tx("DONE")
    print(f"  Sent: {name} | {type_str} | {stat_str}")


def main():
    print(f"Connecting on {PORT}...")
    ser = serial.Serial(PORT, BAUD, timeout=2)
    time.sleep(2)
    print("Ready!\n")

    while True:
        if ser.in_waiting:
            line = ser.readline().decode('utf-8', errors='ignore').strip()
            print(f"Arduino: '{line}'")

            if line.isdigit():
                pid = int(line)
                if pid == 0:
                    ser.write(b"ERROR:invalid id\n")
                    continue

                try:
                    result = fetch_pokemon(pid)
                    if result is None:
                        ser.write(b"ERROR:not found\n")
                        continue

                    name, type_str, stat_str, img_bytes = result
                    chars = sprite_to_lcd_chars(img_bytes)
                    send_to_arduino(ser, name, type_str, stat_str, chars)

                except requests.exceptions.Timeout:
                    ser.write(b"ERROR:timeout\n")
                except Exception as e:
                    print(f"  Error: {e}")
                    ser.write(b"ERROR:failed\n")

        time.sleep(0.05)


if __name__ == '__main__':
    main()