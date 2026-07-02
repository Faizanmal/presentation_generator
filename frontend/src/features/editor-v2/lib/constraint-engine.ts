/**
 * Constraint System
 * Provides responsive constraints and layout rules for canvas elements
 * Features: aspect ratio locks, size constraints, anchoring, responsive scaling
 */

export type AnchorType = 'top-left' | 'top' | 'top-right' | 'left' | 'center' | 'right' | 'bottom-left' | 'bottom' | 'bottom-right';
export type ResizeMode = 'scale' | 'constrain-aspect' | 'free';

export interface Constraint {
  id: string;
  type: 'aspect-ratio' | 'min-width' | 'max-width' | 'min-height' | 'max-height' | 'anchor' | 'responsive-scale';
  value: number | string;
  enabled: boolean;
}

export interface ConstraintSet {
  aspectRatio?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  anchor?: AnchorType;
  scaleWithParent?: boolean;
  parentWidth?: number;
  parentHeight?: number;
  proportionalWidth?: number; // percentage of parent
  proportionalHeight?: number; // percentage of parent
}

export interface ConstrainedSize {
  width: number;
  height: number;
  valid: boolean;
  violations: string[];
}

/**
 * Constraint Engine for responsive layouts
 */
export class ConstraintEngine {
  private constraints: Map<string, ConstraintSet> = new Map();

  /**
   * Add constraints to an element
   */
  public addConstraint(elementId: string, constraint: ConstraintSet): void {
    this.constraints.set(elementId, {
      ...this.constraints.get(elementId),
      ...constraint,
    });
  }

  /**
   * Remove constraints from an element
   */
  public removeConstraint(elementId: string): void {
    this.constraints.delete(elementId);
  }

  /**
   * Apply constraints to a resize operation
   */
  public constrainSize(
    elementId: string,
    width: number,
    height: number
  ): ConstrainedSize {
    const constraints = this.constraints.get(elementId);
    const violations: string[] = [];

    if (!constraints) {
      return { width, height, valid: true, violations };
    }

    let constrainedWidth = width;
    let constrainedHeight = height;

    // Apply aspect ratio constraint
    if (constraints.aspectRatio) {
      const targetRatio = constraints.aspectRatio;
      const currentRatio = width / height;

      if (Math.abs(currentRatio - targetRatio) > 0.01) {
        constrainedHeight = width / targetRatio;
      }
    }

    // Apply width constraints
    if (constraints.minWidth && constrainedWidth < constraints.minWidth) {
      constrainedWidth = constraints.minWidth;
      violations.push(`Width below minimum (${constraints.minWidth}px)`);

      // Recalculate height if aspect ratio is locked
      if (constraints.aspectRatio) {
        constrainedHeight = constrainedWidth / constraints.aspectRatio;
      }
    }

    if (constraints.maxWidth && constrainedWidth > constraints.maxWidth) {
      constrainedWidth = constraints.maxWidth;
      violations.push(`Width exceeds maximum (${constraints.maxWidth}px)`);

      if (constraints.aspectRatio) {
        constrainedHeight = constrainedWidth / constraints.aspectRatio;
      }
    }

    // Apply height constraints
    if (constraints.minHeight && constrainedHeight < constraints.minHeight) {
      constrainedHeight = constraints.minHeight;
      violations.push(`Height below minimum (${constraints.minHeight}px)`);

      if (constraints.aspectRatio) {
        constrainedWidth = constrainedHeight * constraints.aspectRatio;
      }
    }

    if (constraints.maxHeight && constrainedHeight > constraints.maxHeight) {
      constrainedHeight = constraints.maxHeight;
      violations.push(`Height exceeds maximum (${constraints.maxHeight}px)`);

      if (constraints.aspectRatio) {
        constrainedWidth = constrainedHeight * constraints.aspectRatio;
      }
    }

    return {
      width: constrainedWidth,
      height: constrainedHeight,
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Calculate responsive position based on anchor and parent size change
   */
  public calculateResponsivePosition(
    elementId: string,
    x: number,
    y: number,
    oldParentWidth: number,
    oldParentHeight: number,
    newParentWidth: number,
    newParentHeight: number
  ): { x: number; y: number } {
    const constraints = this.constraints.get(elementId);

    if (!constraints || !constraints.scaleWithParent) {
      return { x, y };
    }

    const anchor = constraints.anchor || 'top-left';
    const widthRatio = newParentWidth / oldParentWidth;
    const heightRatio = newParentHeight / oldParentHeight;

    let newX = x;
    let newY = y;

    // Calculate new position based on anchor point
    switch (anchor) {
      case 'top-left':
        newX = x * widthRatio;
        newY = y * heightRatio;
        break;

      case 'top':
        newX = x + (newParentWidth - oldParentWidth) / 2;
        newY = y * heightRatio;
        break;

      case 'top-right':
        newX = x + (newParentWidth - oldParentWidth);
        newY = y * heightRatio;
        break;

      case 'left':
        newX = x * widthRatio;
        newY = y + (newParentHeight - oldParentHeight) / 2;
        break;

      case 'center':
        newX = x + (newParentWidth - oldParentWidth) / 2;
        newY = y + (newParentHeight - oldParentHeight) / 2;
        break;

      case 'right':
        newX = x + (newParentWidth - oldParentWidth);
        newY = y + (newParentHeight - oldParentHeight) / 2;
        break;

      case 'bottom-left':
        newX = x * widthRatio;
        newY = y + (newParentHeight - oldParentHeight);
        break;

      case 'bottom':
        newX = x + (newParentWidth - oldParentWidth) / 2;
        newY = y + (newParentHeight - oldParentHeight);
        break;

      case 'bottom-right':
        newX = x + (newParentWidth - oldParentWidth);
        newY = y + (newParentHeight - oldParentHeight);
        break;
    }

    return { x: Math.round(newX), y: Math.round(newY) };
  }

  /**
   * Calculate size for proportional scaling (percentage-based)
   */
  public calculateProportionalSize(
    elementId: string,
    parentWidth: number,
    parentHeight: number
  ): { width: number; height: number } | null {
    const constraints = this.constraints.get(elementId);

    if (!constraints || (!constraints.proportionalWidth && !constraints.proportionalHeight)) {
      return null;
    }

    const width = constraints.proportionalWidth ? (parentWidth * constraints.proportionalWidth) / 100 : 0;
    const height = constraints.proportionalHeight ? (parentHeight * constraints.proportionalHeight) / 100 : 0;

    return { width, height };
  }

  /**
   * Validate element against constraints
   */
  public validate(
    elementId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): {
    valid: boolean;
    violations: string[];
  } {
    const constraints = this.constraints.get(elementId);
    const violations: string[] = [];

    if (!constraints) {
      return { valid: true, violations };
    }

    if (constraints.minWidth && width < constraints.minWidth) {
      violations.push(`Width ${width}px is below minimum ${constraints.minWidth}px`);
    }

    if (constraints.maxWidth && width > constraints.maxWidth) {
      violations.push(`Width ${width}px exceeds maximum ${constraints.maxWidth}px`);
    }

    if (constraints.minHeight && height < constraints.minHeight) {
      violations.push(`Height ${height}px is below minimum ${constraints.minHeight}px`);
    }

    if (constraints.maxHeight && height > constraints.maxHeight) {
      violations.push(`Height ${height}px exceeds maximum ${constraints.maxHeight}px`);
    }

    if (constraints.aspectRatio) {
      const ratio = width / height;
      if (Math.abs(ratio - constraints.aspectRatio) > 0.01) {
        violations.push(`Aspect ratio ${ratio.toFixed(2)} does not match ${constraints.aspectRatio.toFixed(2)}`);
      }
    }

    return {
      valid: violations.length === 0,
      violations,
    };
  }

  /**
   * Get all constraints for an element
   */
  public getConstraints(elementId: string): ConstraintSet | undefined {
    return this.constraints.get(elementId);
  }

  /**
   * Clear all constraints
   */
  public clear(): void {
    this.constraints.clear();
  }

  /**
   * Export constraints to JSON
   */
  public export(): Record<string, ConstraintSet> {
    const result: Record<string, ConstraintSet> = {};
    this.constraints.forEach((constraint, id) => {
      result[id] = constraint;
    });
    return result;
  }

  /**
   * Import constraints from JSON
   */
  public import(data: Record<string, ConstraintSet>): void {
    Object.entries(data).forEach(([id, constraint]) => {
      this.constraints.set(id, constraint);
    });
  }
}

/**
 * Helper to create common constraint sets
 */
export class ConstraintPresets {
  static aspectRatio(ratio: number): ConstraintSet {
    return { aspectRatio: ratio };
  }

  static fixedSize(width: number, height: number): ConstraintSet {
    return {
      minWidth: width,
      maxWidth: width,
      minHeight: height,
      maxHeight: height,
    };
  }

  static maxSize(width: number, height: number): ConstraintSet {
    return {
      maxWidth: width,
      maxHeight: height,
    };
  }

  static responsiveScaled(
    anchor: AnchorType = 'top-left',
    proportionalWidth?: number,
    proportionalHeight?: number
  ): ConstraintSet {
    return {
      scaleWithParent: true,
      anchor,
      proportionalWidth,
      proportionalHeight,
    };
  }

  static thumbnail(): ConstraintSet {
    return {
      aspectRatio: 16 / 9,
      maxWidth: 200,
      maxHeight: 112.5,
    };
  }

  static widescreen(): ConstraintSet {
    return {
      aspectRatio: 16 / 9,
    };
  }

  static square(): ConstraintSet {
    return {
      aspectRatio: 1,
    };
  }
}
