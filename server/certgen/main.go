package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"math/big"
	"net"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	outDir := "certs"
	if v := os.Getenv("FC_CERT_DIR"); v != "" {
		outDir = v
	}

	hosts := []string{"192.168.0.111", "127.0.0.1", "localhost"}
	if len(os.Args) > 1 {
		hosts = os.Args[1:]
	} else if v := os.Getenv("FC_TLS_HOSTS"); v != "" {
		hosts = strings.Split(v, ",")
	}

	if err := os.MkdirAll(outDir, 0o755); err != nil {
		panic(err)
	}

	caCert, caKey, reused := loadCA(outDir)
	if reused {
		fmt.Println("Reusing existing CA:", filepath.Join(outDir, "ca.pem"))
	} else {
		caKey = genKey()
		caTmpl := &x509.Certificate{
			SerialNumber:          serial(),
			Subject:               pkix.Name{CommonName: "Family Cloud Local CA", Organization: []string{"Family Cloud"}},
			NotBefore:             time.Now().Add(-time.Hour),
			NotAfter:              time.Now().AddDate(10, 0, 0),
			KeyUsage:              x509.KeyUsageCertSign | x509.KeyUsageCRLSign,
			BasicConstraintsValid: true,
			IsCA:                  true,
			MaxPathLenZero:        true,
		}
		caDER, err := x509.CreateCertificate(rand.Reader, caTmpl, caTmpl, &caKey.PublicKey, caKey)
		if err != nil {
			panic(err)
		}
		caCert, err = x509.ParseCertificate(caDER)
		if err != nil {
			panic(err)
		}
		writePEM(filepath.Join(outDir, "ca.pem"), "CERTIFICATE", caDER, 0o644)
		writeKey(filepath.Join(outDir, "ca-key.pem"), caKey)
		fmt.Println("Created new CA:", filepath.Join(outDir, "ca.pem"))
	}

	leafKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}
	leafTmpl := &x509.Certificate{
		SerialNumber: serial(),
		Subject:      pkix.Name{CommonName: strings.TrimSpace(hosts[0]), Organization: []string{"Family Cloud"}},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().AddDate(0, 0, 397),
		KeyUsage:     x509.KeyUsageDigitalSignature,
		ExtKeyUsage:  []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
	}
	for _, h := range hosts {
		h = strings.TrimSpace(h)
		if ip := net.ParseIP(h); ip != nil {
			leafTmpl.IPAddresses = append(leafTmpl.IPAddresses, ip)
		} else {
			leafTmpl.DNSNames = append(leafTmpl.DNSNames, h)
		}
	}
	leafDER, err := x509.CreateCertificate(rand.Reader, leafTmpl, caCert, &leafKey.PublicKey, caKey)
	if err != nil {
		panic(err)
	}

	writePEM(filepath.Join(outDir, "server-cert.pem"), "CERTIFICATE", leafDER, 0o644)
	writeKey(filepath.Join(outDir, "server-key.pem"), leafKey)

	fmt.Printf("Generated certs in %s/ for: %s\n", outDir, strings.Join(hosts, ", "))
	fmt.Println("Install ca.pem as a trusted root certificate on each device.")
}

func serial() *big.Int {
	n, err := rand.Int(rand.Reader, new(big.Int).Lsh(big.NewInt(1), 128))
	if err != nil {
		panic(err)
	}
	return n
}

func genKey() *ecdsa.PrivateKey {
	k, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		panic(err)
	}
	return k
}

func loadCA(dir string) (*x509.Certificate, *ecdsa.PrivateKey, bool) {
	certPEM, err := os.ReadFile(filepath.Join(dir, "ca.pem"))
	if err != nil {
		return nil, nil, false
	}
	keyPEM, err := os.ReadFile(filepath.Join(dir, "ca-key.pem"))
	if err != nil {
		return nil, nil, false
	}
	cb, _ := pem.Decode(certPEM)
	kb, _ := pem.Decode(keyPEM)
	if cb == nil || kb == nil {
		return nil, nil, false
	}
	cert, err := x509.ParseCertificate(cb.Bytes)
	if err != nil {
		return nil, nil, false
	}
	key, err := x509.ParseECPrivateKey(kb.Bytes)
	if err != nil {
		return nil, nil, false
	}
	return cert, key, true
}

func writePEM(path, typ string, der []byte, mode os.FileMode) {
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, mode)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := pem.Encode(f, &pem.Block{Type: typ, Bytes: der}); err != nil {
		panic(err)
	}
}

func writeKey(path string, key *ecdsa.PrivateKey) {
	der, err := x509.MarshalECPrivateKey(key)
	if err != nil {
		panic(err)
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o600)
	if err != nil {
		panic(err)
	}
	defer f.Close()
	if err := pem.Encode(f, &pem.Block{Type: "EC PRIVATE KEY", Bytes: der}); err != nil {
		panic(err)
	}
}
