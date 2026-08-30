package service

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// ComposeFrontmatter adds YAML frontmatter back to the markdown string
func ComposeFrontmatter(metadata map[string]interface{}, content string) (string, error) {
	if len(metadata) == 0 {
		return content, nil
	}

	yamlBytes, err := yaml.Marshal(metadata)
	if err != nil {
		return content, err
	}

	yamlStr := string(yamlBytes)
	if !strings.HasSuffix(yamlStr, "\n") {
		yamlStr += "\n"
	}

	return fmt.Sprintf("---\n%s---\n%s", yamlStr, content), nil
}
