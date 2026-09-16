import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

const GITHUB_API = 'https://api.github.com';

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  url: string;
  stars: number;
  updatedAt: string;
}

export interface GitHubIssue {
  id: number;
  title: string;
  number: number;
  repo: string;
  url: string;
  state: string;
  updatedAt: string;
}

@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);

  constructor(private readonly http: HttpService) {}

  private headers(accessToken: string) {
    return {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    };
  }

  async listRepos(accessToken: string): Promise<GitHubRepo[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GITHUB_API}/user/repos`, {
          headers: this.headers(accessToken),
          params: { sort: 'updated', per_page: 20 },
        }),
      );
      return response.data.map((r: any) => ({
        id: r.id,
        name: r.name,
        fullName: r.full_name,
        private: r.private,
        url: r.html_url,
        stars: r.stargazers_count,
        updatedAt: r.updated_at,
      }));
    } catch (error) {
      this.logger.error('Failed to list GitHub repos', error);
      throw error;
    }
  }

  async listAssignedIssues(accessToken: string): Promise<GitHubIssue[]> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${GITHUB_API}/issues`, {
          headers: this.headers(accessToken),
          params: { filter: 'assigned', state: 'open', per_page: 20 },
        }),
      );
      return response.data
        .filter((i: any) => !i.pull_request)
        .map((i: any) => ({
          id: i.id,
          title: i.title,
          number: i.number,
          repo: i.repository?.full_name ?? '',
          url: i.html_url,
          state: i.state,
          updatedAt: i.updated_at,
        }));
    } catch (error) {
      this.logger.error('Failed to list GitHub assigned issues', error);
      throw error;
    }
  }
}
