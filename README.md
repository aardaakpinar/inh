# INH

Terminalde oynanan, çok oyunculu bir hacking oyunu. Her oyuncu simüle edilmiş bir ağda kendi sunucusunu kurar, başkalarının `secret.txt` dosyasına yazı yazmaya çalışırken kendi dosyasını korur.

> Oyun **tamamen simülasyondur**. IP adresleri (`10.x.x.x`), sunucular ve saldırılar oyunun içinde yaşar; gerçek bir ağa veya cihaza hiçbir şey yapılmaz.

## Gereksinimler

- **Node.js 22.13 veya üstü** ([nodejs.org](https://nodejs.org))
- Windows'ta PowerShell / Komut İstemi, Mac'te Terminal, Linux'ta herhangi bir terminal

## Kurulum

```
npm install
npm run build
```

## Oyunu başlatma

### 1. Sunucuyu aç

Bir terminalde:

```
npm start
```

Sunucu varsayılan olarak `9999` portunda açılır. Pencere açık kalmalıdır; imleç geri dönmez, bu normaldir. Başlangıçta ekrana yerel IP adresin de yazılır.

Farklı bir port kullanmak için:

```
npm start -- --port 9000
```

### 2. Oyuncular bağlansın

Her oyuncu **yeni bir terminal** açar:

```
npm run client -- localhost
```

- **Aynı bilgisayar:** `localhost`
- **Aynı ağ (Wi-Fi/LAN):** Sunucunun ekranda yazan yerel IP'si, örneğin `npm run client -- 192.168.1.20`
- **Farklı port:** `npm run client -- 192.168.1.20 9000`

Güvenlik duvarı izin sorarsa Node.js'e izin ver. İnternet üzerinden oynamak için modemde `9999` TCP portunu sunucu bilgisayarına yönlendirmen veya sunucuyu bir VPS'e kurman gerekir.

İlk girişte 3-12 karakterlik bir kullanıcı adı ve en az 4 karakterlik bir parola belirlersin. Parolanı 3 kez yanlış girersen bağlantı kapanır. Aynı hesapla tekrar girdiğinde kaldığın yerden devam edersin. Aynı hesaba ikinci kez giriş yapılırsa eski bağlantı kapatılır.

Giriş yaptıktan sonra komut istemi `kullanici@sunucu:~$` biçiminde görünür. İlk kez giren oyunculara kısa bir görev listesi gösterilir.

## Nasıl oynanır?

Her oyuncunun bir **sunucusu**, bir **IP adresi**, bir **savunma seviyesi (1-5)**, **puanı** ve bir `secret.txt` dosyası vardır. Ağda ayrıca 8 adet NPC sunucu (`bank-core`, `vpn-edge` vb.) bulunur, yani ağ az oyuncuyla bile boş kalmaz.

**Saldırı akışı**

1. `scan` ile ağdaki sunucuları bul (oyuncu sunucularının tamamı ve NPC'lerden bir örnek listelenir).
2. `portscan <ip>` ile açık portları, işletim sistemi tahminini ve güvenlik seviyesini gör.
3. `exploit <ip> <port>` ile şifre çözme görevini çöz (Base64, ROT, hex, Sezar, katmanlı kodlama; süre 45 sn) **veya** `bruteforce <ip> <port>` ile PIN'i tahmin et.
4. Başarılı olursan 60 saniyelik bir **root shell** açılır: `write <metin>`, `loot`, `backdoor`, `cat secret.txt`, `exit`.

**Savunma**

- Saldırı olunca çevrimiçiysen anında alarm gelir, `logs` ile detayları görürsün.
- `harden`, `firewall`, `audit`, `honeypot`, `lockdown`, `cleanse` ile kendini korursun.

## Komutlar

### Keşif

| Komut             | Açıklama                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| `scan`            | Ağı tarar; oyuncu sunucularını ve NPC örneklerini OS tahminiyle listeler |
| `portscan <ip>`   | Açık portlar, OS tahmini ve güvenlik seviyesi (hedefin loguna düşebilir) |
| `ping <ip>`       | 3 paket gönderir, gecikme istatistiği verir                              |
| `traceroute <ip>` | Hedefe giden rota                                                        |

### Saldırı

| Komut                    | Açıklama                                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `exploit <ip> <port>`    | Sessiz saldırı: şifreli parolayı çöz. Ödül: 20 × hedef seviyesi                                                    |
| `bruteforce <ip> <port>` | 8 denemede PIN bul (`+` doğru yer, `~` yanlış yer). Gürültülü, spoof çalışmaz. Ödül: 25 × seviye                   |
| `spoof [sahte-ip]`       | Sonraki saldırı/tarama için sahte IP (15 puan, tek kullanımlık). Başka oyuncunun IP'sini yazarsan suçu ona atarsın |

Root shell içinde:

| Komut                                         | Açıklama                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `whoami`, `id`                                | Yetkiyi doğrular: `root`                                                                  |
| `hostname`, `uname -a`                        | Hedefin adı ve işletim sistemi bilgisi                                                    |
| `pwd`, `ls`, `ps`                             | Dizin, dosyalar ve çalışan süreçler                                                       |
| `echo <metin>`                                | Metni ekrana yazar                                                                        |
| `write <metin>`                               | Hedefin `secret.txt` dosyasına yazar (oturumda ilk yazış puan verir)                      |
| `loot`                                        | Hedefin puanının bir kısmını çalar (oturum başına 1)                                      |
| `backdoor`                                    | Arka kapı bırakır: sonraki girişlerde görev çözmen gerekmez ama kazanç azdır (5 × seviye) |
| `cat secret.txt`, `clear`, `help`, `exit`     |                                                                                           |

Oturum kapanmadan 10 saniye önce bir uyarı gelir. Süre dolunca bağlantı otomatik kapanır.

### Savunma

| Komut                         | Maliyet     | Açıklama                                                                                                                        |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `harden`                      | 40 × seviye | Seviye +1: saldırı görevleri zorlaşır, bir port kapanır                                                                         |
| `firewall block/unblock <ip>` | ücretsiz    | En fazla 8 IP engelle. Spoof'lular ve arka kapı sahipleri engeli aşar                                                           |
| `audit`                       | 15          | Arka kapıları bulur, siler ve kuran IP'yi gösterir                                                                              |
| `honeypot`                    | 30          | Tuzak: sızan saldırgan `write`/`loot`/`backdoor` yapınca düşer (-20 puan, sana +30, gerçek IP'si loga yazılır). Tek kullanımlık |
| `lockdown`                    | 25          | 60 sn tüm portlar kapanır. Sonrasında 5 dk bekleme                                                                              |
| `cleanse`                     | ücretsiz    | `secret.txt`'i temizler                                                                                                         |

### Genel

`help [komut]`, `status`, `ifconfig`, `logs`, `top`, `cat secret.txt`, `ls`, `clear`, `exit` (`logout` da çalışır)

## Puan sistemi

- Başlangıç: **50 puan**.
- Başarılı `write`: 20 × seviye (`exploit`), 25 × seviye (`bruteforce`), 5 × seviye (arka kapı).
- Savunan, engellenen her başarısız saldırı için **+10** alır.
- `secret.txt` dokunulmamışsa dakikada **+2** pasif puan gelir.
- Honeypot'a düşen saldırgan **-20**, tuzağı kuran **+30** alır.
- Aynı hedefe saldırılar arasında 45 sn bekleme süresi vardır.
- `top` ile ilk 10 oyuncuyu gör.

## İpuçları

- Saldırmadan önce `portscan` yapmak iz bırakır. Önemliyse önce `spoof`.
- `bruteforce` sessiz değildir ama büyük ödül verir; hedefin seviyesi düşükse karlıdır.
- Arka kapılar kalıcıdır. Düzenli `audit` yapmazsan biri sürekli içeride olabilir.
- Bir IP'yi engellemek her zaman yetmez: saldırgan `spoof` kullanabilir.
- Puanlarını `harden` ile mi, `honeypot` ile mi harcayacağına dikkatle karar ver.

## Oyunu sıfırlama

Sunucuyu kapatıp `data/inh-multi.db` dosyasını sil (varsa `-wal` ve `-shm` uzantılı yan dosyalarıyla birlikte). Tekrar başlatınca tüm oyuncular ve NPC'ler yeniden oluşur.

## Güvenlik notu

Oyuncu ile sunucu arasındaki bağlantı **şifrelenmez** (düz TCP) ve oyun açık internete açıldığında trafik okunabilir. Sunucuda parolalar tuzlanıp özetlenerek saklanır, ama yine de oyunda **gerçek hayattaki parolalarını kullanma**.

## Sorun giderme

| Sorun                                   | Çözüm                                                                                     |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `node` komutu bulunamıyor               | Node.js 22.13+ kur. `node -v` ile sürümü kontrol et.                                      |
| `node:sqlite` bulunamadı hatası         | Node sürümün eski; 22.13 veya üstüne güncelle.                                            |
| `dist/index.js` bulunamadı              | Önce `npm install` ve `npm run build` çalıştır.                                           |
| "Bağlanılamadı"                         | Sunucu çalışıyor mu, IP/port doğru mu, güvenlik duvarı portu engelliyor mu kontrol et.    |
| Sunucu başladıktan sonra imleç gelmiyor | Normal. Oyuna **yeni bir terminalden** `npm run client` ile bağlan.                       |
| Port kullanımda hatası                  | Başka bir sunucu açık: kapat veya `--port 9000` ile farklı port ver.                      |
| Renkler bozuk görünüyor                 | Windows Terminal veya güncel PowerShell kullan.                                           |
