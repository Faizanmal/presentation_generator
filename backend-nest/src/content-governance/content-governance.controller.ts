import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  ContentGovernanceService,
  WorkflowStage,
  ContentLockType,
} from './content-governance.service';

// DTOs
class CreateWorkflowDto {
  name: string;
  description?: string;
  stages: WorkflowStage[];
  requiredApprovers: Record<
    WorkflowStage,
    { minApprovals: number; approverRoles: string[] }
  >;
  autoPublish?: boolean;
}

class SubmitApprovalDto {
  workflowId: string;
  message?: string;
}

class ProcessApprovalDto {
  action: 'approve' | 'reject' | 'request_changes';
  comment?: string;
}

class AddCommentDto {
  content: string;
}

class CreateDisclaimerDto {
  name: string;
  content: string;
  placement: 'first_slide' | 'last_slide' | 'all_slides' | 'custom';
  categories?: string[];
  isRequired?: boolean;
}

class LockContentDto {
  slideId?: string;
  blockId?: string;
  lockType: ContentLockType;
  reason?: string;
  expiresAt?: string;
}

class CreatePolicyDto {
  name: string;
  rules: Array<{
    type:
      | 'required_fields'
      | 'forbidden_content'
      | 'required_disclaimers'
      | 'approval_required';
    config: Record<string, unknown>;
  }>;
  enforcementLevel: 'warn' | 'block';
}

@Controller('governance')
@UseGuards(JwtAuthGuard)
export class ContentGovernanceController {
  constructor(private readonly governanceService: ContentGovernanceService) {}

  // Workflows
  @Post('organizations/:orgId/workflows')
  async createWorkflow(
    @Param('orgId') orgId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.governanceService.createWorkflow(orgId, dto);
  }

  @Get('organizations/:orgId/workflows')
  async getWorkflows(@Param('orgId') orgId: string) {
    return this.governanceService.getOrganizationWorkflows(orgId);
  }

  // Approval Requests
  @Post('projects/:projectId/submit-approval')
  async submitForApproval(
    @Param('projectId') projectId: string,
    @Body() dto: SubmitApprovalDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.governanceService.submitForApproval(
      projectId,
      user.id,
      dto.workflowId,
      dto.message,
    );
  }

  @Post('requests/:requestId/process')
  async processApproval(
    @Param('requestId') requestId: string,
    @Body() dto: ProcessApprovalDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.governanceService.processApproval(
      requestId,
      user.id,
      dto.action,
      dto.comment,
    );
  }

  @Post('requests/:requestId/comments')
  async addComment(
    @Param('requestId') requestId: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.governanceService.addComment(requestId, user.id, dto.content);
  }

  @Get('projects/:projectId/approval-history')
  async getApprovalHistory(@Param('projectId') projectId: string) {
    return this.governanceService.getApprovalHistory(projectId);
  }

  // Disclaimers
  @Post('organizations/:orgId/disclaimers')
  async createDisclaimer(
    @Param('orgId') orgId: string,
    @Body() dto: CreateDisclaimerDto,
  ) {
    return this.governanceService.createDisclaimer(orgId, dto);
  }

  @Get('projects/:projectId/organizations/:orgId/disclaimers')
  async getApplicableDisclaimers(
    @Param('projectId') projectId: string,
    @Param('orgId') orgId: string,
  ) {
    return this.governanceService.getApplicableDisclaimers(projectId, orgId);
  }

  @Get('projects/:projectId/organizations/:orgId/check-disclaimers')
  async checkDisclaimers(
    @Param('projectId') projectId: string,
    @Param('orgId') orgId: string,
  ) {
    return this.governanceService.checkDisclaimers(projectId, orgId);
  }

  // Content Locks
  @Post('projects/:projectId/locks')
  async lockContent(
    @Param('projectId') projectId: string,
    @Body() dto: LockContentDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.governanceService.lockContent(projectId, user.id, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @Delete('locks/:lockId')
  async unlockContent(
    @Param('lockId') lockId: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.governanceService.unlockContent(lockId, user.id);
    return { success: true };
  }

  @Get('projects/:projectId/check-lock')
  async isContentLocked(@Param('projectId') projectId: string) {
    return this.governanceService.isContentLocked(projectId);
  }

  // Policies
  @Post('organizations/:orgId/policies')
  async createPolicy(
    @Param('orgId') orgId: string,
    @Body() dto: CreatePolicyDto,
  ) {
    return this.governanceService.createPolicy(orgId, dto);
  }

  @Get('projects/:projectId/validate')
  async validateContent(@Param('projectId') projectId: string) {
    const violations = await this.governanceService.validateContent(projectId);
    return {
      valid: violations.length === 0,
      violations,
    };
  }
}
