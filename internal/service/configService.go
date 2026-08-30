package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type Config struct {
	GroqAPIKey string `json:"groqApiKey"`
}

type ConfigService struct {
	mu         sync.RWMutex
	configPath string
	config     *Config
}

func NewConfigService() *ConfigService {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = "."
	}
	appConfigDir := filepath.Join(configDir, "AaronSquared")
	_ = os.MkdirAll(appConfigDir, 0755)

	configPath := filepath.Join(appConfigDir, "config.json")
	
	cs := &ConfigService{
		configPath: configPath,
		config:     &Config{},
	}
	cs.load()
	return cs
}

func (s *ConfigService) load() {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := os.ReadFile(s.configPath)
	if err == nil {
		_ = json.Unmarshal(data, s.config)
	}
}

func (s *ConfigService) save() error {
	data, err := json.MarshalIndent(s.config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.configPath, data, 0644)
}

func (s *ConfigService) GetGroqAPIKey() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.config.GroqAPIKey
}

func (s *ConfigService) SetGroqAPIKey(key string) error {
	s.mu.Lock()
	s.config.GroqAPIKey = key
	s.mu.Unlock()
	return s.save()
}
