package domain

import "context"

type AIProvider interface {
	GenerateMarkdown(ctx context.Context, apiKey string, prompt string) (string, error)
}
